import json


def parse_json_response(content: str) -> dict:
    """
    Robustly extract and parse a JSON object from an LLM response.
    Handles markdown code fences and leading/trailing prose.
    """
    content = content.strip()

    # Strip markdown code fences  ```json ... ```  or  ``` ... ```
    if content.startswith("```"):
        lines = content.splitlines()
        # Drop opening fence line (```json or ```)
        lines = lines[1:]
        # Drop closing fence line if present
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        content = "\n".join(lines).strip()

    # Direct parse
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass

    # Find first { ... last } and try again
    start = content.find("{")
    end = content.rfind("}") + 1
    if start != -1 and end > start:
        try:
            return json.loads(content[start:end])
        except json.JSONDecodeError:
            pass

    return {"error": "Failed to parse agent response", "raw": content[:500]}
