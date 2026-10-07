"""TXT: one or more quoted strings, e.g. "v=spf1 include:_spf.example.com ~all"

Each string can be up to 255 characters and the whole value up to 4,000.
If the user forgot the quotes, the value is quoted for them.
"""

from app.validators.base import require_values, validate_each

MAX_STRING = 255
MAX_VALUE = 4000


def split_quoted(value: str) -> list[str]:
    """Split '"abc" "d\\"ef"' into ['abc', 'd"ef']. Raises on unbalanced quotes."""
    strings: list[str] = []
    i = 0
    while i < len(value):
        char = value[i]
        if char.isspace():
            i += 1
            continue
        if char != '"':
            raise ValueError("Text outside quotation marks")
        i += 1
        current: list[str] = []
        while i < len(value) and value[i] != '"':
            if value[i] == "\\" and i + 1 < len(value):
                current.append(value[i + 1])
                i += 2
                continue
            current.append(value[i])
            i += 1
        if i >= len(value):
            raise ValueError("Unbalanced quotation marks")
        strings.append("".join(current))
        i += 1
    return strings


def quote(text: str) -> str:
    return '"' + text.replace("\\", "\\\\").replace('"', '\\"') + '"'


def _check(value: str) -> str:
    if not value:
        raise ValueError("A TXT value can't be empty.")
    if value.startswith('"'):
        try:
            strings = split_quoted(value)
        except ValueError:
            raise ValueError(f"The TXT value has unbalanced quotation marks: {value}") from None
    else:
        strings = [value]
    for string in strings:
        if len(string) > MAX_STRING:
            raise ValueError(
                f"Each string in a TXT value can have a maximum of {MAX_STRING} characters. "
                "Split longer text into several quoted strings."
            )
    normalised = " ".join(quote(s) for s in strings)
    if len(normalised) > MAX_VALUE:
        raise ValueError(f"A TXT value can have a maximum of {MAX_VALUE} characters.")
    return normalised


def validate(values: list[str]) -> list[str]:
    require_values(values, type_name="TXT")
    return validate_each(values, _check)
