import os
import sys
import json
import requests

def get_pr_diff(repo: str, pr_number: str, token: str) -> str:
    """從 GitHub REST API 讀取 PR 的變更差異 (Diff)"""
    url = f"https://api.github.com/repos/{repo}/pulls/{pr_number}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3.diff"
    }
    resp = requests.get(url, headers=headers)
    if resp.status_code != 200:
        print(f"Error fetching PR diff: {resp.status_code} - {resp.text}")
        sys.exit(1)
    return resp.text

def call_gemini_ice(diff_content: str, gemini_api_key: str) -> str:
    """呼叫 Gemini 作為 BD & GEO Independent Checking Engineer (ICE) 進行審查"""
    # 限制 diff 大小以防超長文本超載
    truncated_diff = diff_content[:25000] if len(diff_content) > 25000 else diff_content

    system_prompt = (
        "You are acting as the Independent Checking Engineer (ICE) representing the Hong Kong "
        "Buildings Department (BD) and Geotechnical Engineering Office (GEO). "
        "Your task is to audit the Retaining Wall design calculations, source code algorithms, and formulas "
        "submitted in this GitHub Pull Request.\n\n"
        "STRICT AUDIT CRITERIA:\n"
        "1. Geoguide 1 (2nd Edition) Compliance:\n"
        "   - Clause 6.4: Active earth pressure must not be less than minimum equivalent fluid pressure of 5H (kN/m).\n"
        "   - Clause 6.5: Compaction-induced residual earth pressure envelope must be accounted for.\n"
        "   - Passive Resistance (Pp): Deduct minimum 0.5m - 1.0m for unplanned utility excavation.\n"
        "   - Water table: Check if weephole blockage conditions (1/3 H, 1/2 H, or perched water) are handled.\n"
        "2. Geotechnical Stability (Foundation Code 2017 / Geoguide 1):\n"
        "   - Sliding: FoS >= 1.5 (Working Stress) or Equilibrium Ratio >= 1.0 (Limit State).\n"
        "   - Overturning: FoS >= 2.0 about Toe. NEVER allow surcharge over the heel to act as a restoring force during sliding/overturning.\n"
        "   - Eccentricity: e <= B/6 on soil. If e > B/6, verify trapezoidal stress formula is replaced by triangular distribution (q_max = 2V / 3x_net).\n"
        "3. RC Structural Design (HK Concrete Code 2013):\n"
        "   - Bending: K <= 0.156, lever arm z <= 0.95d.\n"
        "   - Shear: Nominal shear stress v <= vc with material factor 1.25.\n"
        "   - Crack Width: w <= 0.2mm (earth/water face) or 0.3mm per Clause 7.3.4.\n\n"
        "OUTPUT FORMAT (Markdown):\n"
        "Start with an Executive Verdict Badge: [✅ APPROVED] / [⚠️ APPROVED WITH ADVISORY] / [❌ REQUEST CHANGES].\n"
        "Follow with:\n"
        "### 1. Audit Summary & Code Compliance Table\n"
        "### 2. Critical Discrepancies & Deficiencies (if any)\n"
        "### 3. Verification of Mathematical Formulas in PR Diff\n"
        "### 4. Required Action Items for Design Engineer (Claude)"
    )

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_api_key}"
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": f"System Instruction:\n{system_prompt}\n\nHere is the Pull Request Diff to review:\n```diff\n{truncated_diff}\n```"}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.2
        }
    }

    resp = requests.post(url, json=payload, headers={"Content-Type": "application/json"})
    if resp.status_code != 200:
        print(f"Error calling Gemini API: {resp.status_code} - {resp.text}")
        sys.exit(1)

    result_json = resp.json()
    try:
        return result_json["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        print(f"Unexpected response format: {result_json}")
        sys.exit(1)

def post_github_comment(repo: str, pr_number: str, token: str, comment: str):
    """將 Gemini 審核意見發佈到 PR 評論區"""
    url = f"https://api.github.com/repos/{repo}/issues/{pr_number}/comments"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json"
    }
    header_banner = "## 🏛️ BD & GEO Independent Checker Review Report (Gemini ICE)\n\n"
    payload = {"body": header_banner + comment}
    
    resp = requests.post(url, json=payload, headers=headers)
    if resp.status_code != 201:
        print(f"Failed to post comment: {resp.status_code} - {resp.text}")
        sys.exit(1)
    print(f"Successfully posted BD/GEO review to PR #{pr_number}")

if __name__ == "__main__":
    gemini_key = os.environ.get("GEMINI_API_KEY")
    github_token = os.environ.get("GITHUB_TOKEN")
    pr_num = os.environ.get("PR_NUMBER")
    repo_name = os.environ.get("REPO_FULL_NAME")

    if not all([gemini_key, github_token, pr_num, repo_name]):
        print("Missing required environment variables.")
        sys.exit(1)

    print(f"Fetching diff for PR #{pr_num} in {repo_name}...")
    diff = get_pr_diff(repo_name, pr_num, github_token)

    if not diff.strip():
        print("Diff is empty, skipping check.")
        sys.exit(0)

    print("Running BD & GEO independent review via Gemini API...")
    review_report = call_gemini_ice(diff, gemini_key)

    print("Posting review back to GitHub Pull Request...")
    post_github_comment(repo_name, pr_num, github_token, review_report)
