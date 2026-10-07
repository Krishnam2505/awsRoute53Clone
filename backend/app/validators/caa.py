"""CAA: 'flags tag "value"', e.g. 0 issue "ca.example.net" """

from app.validators.base import parse_int, require_values, validate_each
from app.validators.txt import quote, split_quoted

TAGS = ("issue", "issuewild", "iodef")


def _check(value: str) -> str:
    parts = value.split(None, 2)
    if len(parts) != 3:
        raise ValueError(
            f'A CAA value must be flags, tag and value, for example 0 issue "ca.example.net": '
            f"{value}"
        )
    flags = parse_int(parts[0], 0, 255, "The CAA flags")
    tag = parts[1].lower()
    if tag not in TAGS:
        raise ValueError(f"The CAA tag must be issue, issuewild or iodef: {parts[1]}")
    raw = parts[2].strip()
    if raw.startswith('"'):
        try:
            strings = split_quoted(raw)
        except ValueError:
            raise ValueError(f"The CAA value has unbalanced quotation marks: {value}") from None
        if len(strings) != 1:
            raise ValueError(f"The CAA value must be one quoted string: {value}")
        text = strings[0]
    else:
        text = raw
    return f"{flags} {tag} {quote(text)}"


def validate(values: list[str]) -> list[str]:
    require_values(values, type_name="CAA")
    return validate_each(values, _check)
