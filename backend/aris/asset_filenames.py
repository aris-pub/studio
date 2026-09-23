"""Validation for file-asset filenames.

Asset filenames are joined onto a temporary directory and written to disk during
PDF export (see routes/file.py), so a name carrying a path would write outside
that directory as the backend user. Names are checked here at every point where
one enters the system, and again at the write site for rows that predate this.
"""



def validate_asset_filename(filename: str) -> str:
    """Return *filename* reduced to a bare name.

    A plain directory prefix is stripped, because clients legitimately send
    names like ``figures/plot.png``. A parent-directory reference is rejected
    rather than stripped: nothing sends one by accident, and rewriting it would
    hide the attempt.

    Parameters
    ----------
    filename : str
        The candidate name, as supplied by the client.

    Returns
    -------
    str
        The name with any directory part removed.

    Raises
    ------
    ValueError
        If the name is empty, is a directory reference, contains a null byte,
        or contains a ".." component.

    """
    raw = filename.strip()
    if "\x00" in raw:
        raise ValueError("filename must not contain a null byte")

    # Splitting on "/" alone would let a Windows-style path through intact,
    # so treat both characters as separators.
    parts = raw.replace("\\", "/").split("/")
    if any(part == ".." for part in parts):
        raise ValueError("filename must not contain a parent-directory reference")

    name = parts[-1]
    if name in ("", "."):
        raise ValueError("filename must not be empty or a directory reference")
    return name
