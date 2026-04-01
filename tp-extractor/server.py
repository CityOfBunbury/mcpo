import asyncio
import json
import os
import re
from typing import Any

from bs4 import BeautifulSoup
from fastmcp import FastMCP
from playwright.async_api import Browser, BrowserContext, async_playwright

mcp = FastMCP("tp-extractor")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)

BASE_URL = "https://talentpropeller.com"
CAMPAIGNS_URL = f"{BASE_URL}/customerapplications"
LOGIN_URL = f"{BASE_URL}/login"

PII_FIELDS = {
    "first_name", "surname", "last_name", "email", "mobile", "phone",
    "a_h_phone", "address", "suburb", "postcode", "state", "gender",
    "diversity", "aboriginal", "torres_strait", "identify",
}

PII_KEYWORDS = list(PII_FIELDS)


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------


async def _try_email_login(browser: Browser) -> tuple[BrowserContext | None, str]:
    """
    Attempt form-based login with TP_EMAIL / TP_PASSWORD.
    Returns (context, "") on success or (None, error_message) on failure.
    """
    email = os.environ.get("TP_EMAIL", "")
    password = os.environ.get("TP_PASSWORD", "")

    context = await browser.new_context(user_agent=USER_AGENT)
    page = await context.new_page()
    try:
        await page.goto(LOGIN_URL, wait_until="networkidle")

        # Fill email field
        filled_email = False
        for sel in ('input[name="email"]', 'input[type="email"]'):
            if await page.locator(sel).count() > 0:
                await page.fill(sel, email)
                filled_email = True
                break
        if not filled_email:
            await page.close()
            await context.close()
            return None, "Login form: email input not found."

        # Fill password field
        filled_pass = False
        for sel in ('input[name="password"]', 'input[type="password"]'):
            if await page.locator(sel).count() > 0:
                await page.fill(sel, password)
                filled_pass = True
                break
        if not filled_pass:
            await page.close()
            await context.close()
            return None, "Login form: password input not found."

        # Submit
        submitted = False
        for sel in ('button[type="submit"]', 'input[type="submit"]'):
            if await page.locator(sel).count() > 0:
                await page.locator(sel).first.click()
                submitted = True
                break
        if not submitted:
            await page.keyboard.press("Enter")

        # Wait for navigation away from the login page
        try:
            await page.wait_for_url(
                lambda url: "/login" not in url,
                timeout=10_000,
            )
        except Exception:
            await page.close()
            await context.close()
            return None, "Login failed: still on login page after submit (wrong credentials?)."

        await page.close()
        return context, ""

    except Exception as exc:
        await page.close()
        await context.close()
        return None, f"Login error: {exc}"


async def _authenticate(browser: Browser) -> tuple[BrowserContext, str]:
    """
    Return an authenticated BrowserContext and a description of the method used.

    Uses email/password login via TP_EMAIL and TP_PASSWORD env vars.
    """
    email = os.environ.get("TP_EMAIL", "")
    password = os.environ.get("TP_PASSWORD", "")

    if email and password:
        context, err = await _try_email_login(browser)
        if context is not None:
            return context, "login (email/password)"
        # Login failed
        context = await browser.new_context(user_agent=USER_AGENT)
        return context, f"unauthenticated — login failed: {err}"

    # Nothing configured — return an unauthenticated context so callers can
    # surface a useful error message.
    context = await browser.new_context(user_agent=USER_AGENT)
    return context, "unauthenticated — set TP_EMAIL+TP_PASSWORD"


def _no_auth_configured() -> bool:
    email = os.environ.get("TP_EMAIL", "")
    password = os.environ.get("TP_PASSWORD", "")
    return not (email and password)


# ---------------------------------------------------------------------------
# PII helpers
# ---------------------------------------------------------------------------

def _strip_pii(data: dict[str, Any]) -> dict[str, Any]:
    result = {}
    for k, v in data.items():
        key_lower = k.lower().replace(" ", "_").replace("/", "_")
        if any(pii in key_lower for pii in PII_KEYWORDS):
            continue
        result[k] = v
    return result


def _strip_pii_questions(questions: dict[str, Any]) -> dict[str, Any]:
    result = {}
    for q, a in questions.items():
        q_lower = q.lower().replace(" ", "_").replace("/", "_")
        if any(pii in q_lower for pii in PII_KEYWORDS):
            continue
        result[q] = a
    return result


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

@mcp.tool()
async def test_connection() -> str:
    """
    Test connectivity to talentpropeller.com and verify authentication works.
    Reports which auth method was used (email/password login or session cookie).
    """
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            context, auth_method = await _authenticate(browser)

            page = await context.new_page()

            # Step 1: home page
            response = await page.goto(BASE_URL, wait_until="networkidle")
            home_status = response.status if response else "unknown"

            await asyncio.sleep(1)

            # Step 2: campaigns page
            response2 = await page.goto(CAMPAIGNS_URL, wait_until="networkidle")
            camp_status = response2.status if response2 else "unknown"

            html = await page.content()
            soup = BeautifulSoup(html, "html.parser")
            table = soup.find("table", class_="table_list")
            table_found = table is not None

            lines = [
                f"Auth method: {auth_method}",
                f"Home page status: {home_status}",
                f"Campaigns page status: {camp_status}",
                f"Campaign table (table_list) found: {table_found}",
            ]
            if auth_method.startswith("unauthenticated"):
                lines.append("WARNING: No credentials configured. Set TP_EMAIL+TP_PASSWORD.")
            if not table_found:
                lines.append("Authentication may have failed — table not found.")

            return "\n".join(lines)
        except Exception as e:
            return f"Error during connection test: {e}"
        finally:
            await browser.close()


@mcp.tool()
async def list_campaigns() -> str:
    """
    List all active campaigns from talentpropeller.com/customerapplications.
    Returns job number, title, branch, opened date, closing date, and applicant count.
    """
    if _no_auth_configured():
        return "Error: no credentials configured. Set TP_EMAIL+TP_PASSWORD."

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            context, auth_method = await _authenticate(browser)

            page = await context.new_page()
            response = await page.goto(CAMPAIGNS_URL, wait_until="networkidle")
            if response and response.status != 200:
                return f"Error: campaigns page returned HTTP {response.status}."

            html = await page.content()
            soup = BeautifulSoup(html, "html.parser")
            table = soup.find("table", class_="table_list")
            if not table:
                return (
                    f"Error: campaign table not found (auth: {auth_method}). "
                    "Credentials may be wrong."
                )

            rows = table.find_all("tr")
            campaigns = []
            for row in rows:
                if row.find("img"):
                    continue
                cells = row.find_all("td")
                if not cells:
                    continue
                first_text = cells[0].get_text(strip=True)
                if first_text.lower() in ("job no", "job no.", "#", ""):
                    continue

                try:
                    job_no = cells[0].get_text(strip=True)
                    branch = cells[1].get_text(strip=True) if len(cells) > 1 else ""
                    title_cell = cells[2] if len(cells) > 2 else None
                    title = ""
                    campaign_url = ""
                    if title_cell:
                        link = title_cell.find("a")
                        if link:
                            title = link.get_text(strip=True)
                            href = link.get("href", "")
                            campaign_url = href if href.startswith("http") else BASE_URL + href
                        else:
                            title = title_cell.get_text(strip=True)

                    opened = cells[3].get_text(strip=True) if len(cells) > 3 else ""
                    closing = cells[4].get_text(strip=True) if len(cells) > 4 else ""
                    applicants = cells[5].get_text(strip=True) if len(cells) > 5 else ""

                    if not job_no and not title:
                        continue

                    campaigns.append({
                        "job_no": job_no,
                        "branch": branch,
                        "title": title,
                        "opened": opened,
                        "closing": closing,
                        "applicants": applicants,
                        "url": campaign_url,
                    })
                except (IndexError, AttributeError):
                    continue

            if not campaigns:
                return f"No campaigns found (auth: {auth_method})."

            lines = [f"Found {len(campaigns)} campaign(s) (auth: {auth_method}):\n"]
            for c in campaigns:
                lines.append(
                    f"  Job #{c['job_no']} | {c['title']}\n"
                    f"    Branch: {c['branch']} | Opened: {c['opened']} | Closing: {c['closing']} | Applicants: {c['applicants']}\n"
                    f"    URL: {c['url']}"
                )
            return "\n".join(lines)

        except Exception as e:
            return f"Error listing campaigns: {e}"
        finally:
            await browser.close()


def _parse_af_page(html: str) -> tuple[dict[str, str], dict[str, str]]:
    """
    Parse an application form page.
    Returns (contact_fields, questionnaire_responses).
    """
    soup = BeautifulSoup(html, "html.parser")
    contact: dict[str, str] = {}
    questions: dict[str, str] = {}

    CONTACT_LABELS = {
        "job title", "first name", "surname", "address", "state",
        "mobile", "suburb", "a/h phone", "postcode", "email",
    }

    all_tds = soup.find_all("td")
    for td in all_tds:
        text = td.get_text(strip=True).rstrip(":").lower()
        if text in CONTACT_LABELS:
            nxt = td.find_next_sibling("td")
            if nxt is not None:
                inp = nxt.find("input")
                if inp:
                    val = inp.get("value", "").strip()
                else:
                    val = nxt.get_text(strip=True)
                field_key = text.replace(" ", "_").replace("/", "_")
                contact[field_key] = val

    for td in soup.find_all("td"):
        style = td.get("style", "")
        if "background-color" not in style.lower():
            continue
        q_text = td.get_text(strip=True)
        if len(q_text) <= 10:
            continue

        parent_table = td.find_parent("table")
        if not parent_table:
            continue

        answer = ""

        radio = parent_table.find("input", {"type": "radio", "checked": True})
        if radio:
            parent_td = radio.find_parent("td")
            if parent_td:
                answer = re.sub(r"^Answers?\s*", "", parent_td.get_text(strip=True)).strip()
            else:
                answer = radio.get("value", "").strip()

        if not answer:
            checkboxes = parent_table.find_all("input", {"type": "checkbox", "checked": True})
            if checkboxes:
                answer = ", ".join(cb.get("value", "").strip() for cb in checkboxes)

        if not answer:
            textarea = parent_table.find("textarea")
            if textarea:
                answer = textarea.get_text(strip=True)

        if not answer:
            text_input = parent_table.find("input", {"type": "text"})
            if text_input:
                answer = text_input.get("value", "").strip()

        if not answer:
            select = parent_table.find("select")
            if select:
                selected = select.find("option", {"selected": True})
                if selected:
                    answer = selected.get_text(strip=True)

        questions[q_text] = answer

    return contact, questions


@mcp.tool()
async def extract_campaign_applicants(campaign_identifier: str) -> str:
    """
    Extract applicant data for a campaign, identified by name, job number, or full URL.
    Returns a summary table and PII-stripped detailed JSON.
    """
    if _no_auth_configured():
        return "Error: no credentials configured. Set TP_EMAIL+TP_PASSWORD."

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            context, auth_method = await _authenticate(browser)

            # --- Resolve campaign URL ---
            campaign_url = ""
            if campaign_identifier.startswith("http"):
                campaign_url = campaign_identifier
            else:
                page = await context.new_page()
                await page.goto(CAMPAIGNS_URL, wait_until="networkidle")
                html = await page.content()
                await page.close()

                soup = BeautifulSoup(html, "html.parser")
                table = soup.find("table", class_="table_list")
                if not table:
                    return (
                        f"Error: campaign table not found (auth: {auth_method}). "
                        "Credentials may be wrong."
                    )

                ident_lower = campaign_identifier.lower()
                for row in table.find_all("tr"):
                    if row.find("img"):
                        continue
                    cells = row.find_all("td")
                    if len(cells) < 3:
                        continue
                    job_no = cells[0].get_text(strip=True)
                    title_cell = cells[2]
                    link = title_cell.find("a")
                    if not link:
                        continue
                    title = link.get_text(strip=True)
                    href = link.get("href", "")

                    if job_no == campaign_identifier or ident_lower in title.lower():
                        campaign_url = href if href.startswith("http") else BASE_URL + href
                        break

                if not campaign_url:
                    return f"Error: could not find a campaign matching '{campaign_identifier}'."

            # --- Fetch campaign detail page ---
            await asyncio.sleep(1)
            page = await context.new_page()
            response = await page.goto(campaign_url, wait_until="networkidle")
            if response and response.status != 200:
                return f"Error: campaign page returned HTTP {response.status}."

            html = await page.content()
            await page.close()

            soup = BeautifulSoup(html, "html.parser")

            applicant_rows = []
            for row in soup.find_all("tr"):
                links = row.find_all("a", href=True)
                af_link = None
                cv_link = None
                for lnk in links:
                    href = lnk["href"]
                    if "/applicationscv/detailJob/" in href:
                        af_link = href if href.startswith("http") else BASE_URL + href
                    elif "/applicationscv/detailcv/" in href:
                        cv_link = href if href.startswith("http") else BASE_URL + href
                if af_link or cv_link:
                    applicant_rows.append((row, af_link, cv_link))

            if not applicant_rows:
                return "No applicants found for this campaign."

            # --- Extract each applicant ---
            all_applicants = []
            for idx, (row, af_link, cv_link) in enumerate(applicant_rows):
                cells = row.find_all("td")

                name = ""
                applied_date = ""
                score = ""
                for cell in cells:
                    text = cell.get_text(strip=True)
                    if re.match(r"\d{4}-\d{2}-\d{2}", text):
                        applied_date = text[:10]
                    elif text.endswith("%"):
                        score = text
                    elif text.lower() not in ("view", "buy", "notes", "") and not re.match(r"^\d+$", text) and len(text) > 2:
                        if len(text) > len(name):
                            name = text
                # Clean up trailing markers
                name = name.rstrip("* ").strip()

                candidate_id = f"C{idx + 1:03d}"

                contact: dict[str, str] = {}
                questionnaire: dict[str, str] = {}
                if af_link:
                    try:
                        await asyncio.sleep(1)
                        af_page = await context.new_page()
                        await af_page.goto(af_link, wait_until="networkidle")
                        af_html = await af_page.content()
                        await af_page.close()
                        contact, questionnaire = _parse_af_page(af_html)
                    except Exception as e:
                        contact = {}
                        questionnaire = {"parse_error": str(e)}

                all_applicants.append({
                    "candidate_id": candidate_id,
                    "name": name,
                    "applied_date": applied_date,
                    "score": score,
                    "af_url": af_link or "",
                    "cv_url": cv_link or "",
                    "contact": contact,
                    "questionnaire": questionnaire,
                })

            # --- Build output ---
            summary_lines = [
                f"{'Candidate':<12} {'Name':<30} {'Applied':<14} {'Score'}",
                "-" * 65,
            ]
            for a in all_applicants:
                summary_lines.append(
                    f"{a['candidate_id']:<12} {a['name'][:29]:<30} {a['applied_date']:<14} {a['score']}"
                )

            stripped = []
            for a in all_applicants:
                stripped.append({
                    "candidate_id": a["candidate_id"],
                    "applied_date": a["applied_date"],
                    "score": a["score"],
                    "contact": _strip_pii(a["contact"]),
                    "questionnaire": _strip_pii_questions(a["questionnaire"]),
                })

            output = (
                f"## Applicant Summary (auth: {auth_method})\n\n"
                + "\n".join(summary_lines)
                + "\n\n## Detailed Data (PII stripped)\n\n```json\n"
                + json.dumps(stripped, indent=2)
                + "\n```"
            )
            return output

        except Exception as e:
            return f"Error extracting applicants: {e}"
        finally:
            await browser.close()


if __name__ == "__main__":
    mcp.run(transport="stdio")
