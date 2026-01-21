from .models import File, FileStatus, Tag, User


MOCK_USERS = [
    User(
        name="John Doe",
        email="john.doe@example.com",
        password_hash="hashedpassword1",
    ),
    User(
        name="Jane Smith",
        email="jane.smith@example.com",
        password_hash="hashedpassword2",
    ),
    User(
        name="Alice Johnson",
        email="alice.johnson@example.com",
        password_hash="hashedpassword3",
    ),
    User(
        name="Test User",
        email="testuser@aris.pub",
        password_hash="$2b$12$TVuqGqn6SWbVFres301hUu6BtCWQHa.xpGPK4EwAKZo8mw50WXKBW",
    ),
]


MOCK_FILES = [
    File(
        title="Just a title",
        abstract="This is the abstract of sample file 1.",
        keywords="sample, research, test",
        status=FileStatus.DRAFT,
        owner_id=1,
        source="""\
        # Just a title
        """,
    ),
    File(
        title="Title and a paragraph",
        abstract="This is the abstract of sample file 2.",
        keywords="example, science, test",
        status=FileStatus.DRAFT,
        owner_id=2,
        source="""\
        # My Title

        Lorem ipsum.
        """,
    ),
    File(
        title="Title, Section, and ParagraphSample File 3",
        abstract="This is the abstract of sample file 3.",
        keywords="research, test, study",
        status=FileStatus.DRAFT,
        owner_id=3,
        source="""\
        Lorem ipsum.

        ## Section title

        Lorem ipsum.
        """,
    ),
    File(
        title="Test Visual Regression File",
        abstract="Stable test file for visual regression testing.",
        keywords="test, visual, regression",
        status=FileStatus.DRAFT,
        owner_id=4,
        source="""\
        # Test Visual Regression File

        This file is used for visual regression testing.
        Content should remain stable.

        ## Section 1
        Lorem ipsum test content.

        ## Section 2
        More stable test content here.
        """,
    ),
    File(
        title="Another Test File",
        abstract="Second stable test file.",
        keywords="test, stable, visual",
        status=FileStatus.DRAFT,
        owner_id=4,
        source="""\
        # Another Test File

        This is another stable test file for visual tests.
        """,
    ),
]


MOCK_TAGS = [
    Tag(name="Research", user_id=1, color="ORANGE"),
    Tag(name="Data Analysis", user_id=1, color="RED"),
    Tag(name="Machine Learning", user_id=2, color="PURPLE"),
    Tag(name="Deep Learning", user_id=2, color="GREEN"),
    Tag(name="Network Science", user_id=2, color="RED"),
    Tag(name="Data Science", user_id=3, color="GREEN"),
    Tag(name="AI Ethics", user_id=3, color="ORANGE"),
    Tag(name="Databases", user_id=3, color="PURPLE"),
    Tag(name="Chem. Eng.", user_id=3, color="GREEN"),
    Tag(name="Visual Testing", user_id=4, color="BLUE"),
    Tag(name="Regression", user_id=4, color="GREEN"),
]
