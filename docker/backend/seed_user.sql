-- Complete seed for foo@bar.com user and all their data
-- This will be run after migrations to ensure consistent user data across all clones

-- Insert user if not exists
INSERT INTO users (id, name, email, password_hash, deleted_at, initials, created_at, last_login, avatar_color, profile_picture_id)
VALUES (4, 'Leo Torres', 'foo@bar.com', '$2b$12$RayS.yAehYjR.Ah2A7tAte8tkeul.F/eu1uCSzM/Su3GDb0ZIaDQy', NULL, 'LT', '2025-06-03 21:02:32.135452+00', NULL, 'BLUE', NULL)
ON CONFLICT (email) DO NOTHING;

-- Insert all tags
INSERT INTO tags (id, user_id, name, color, created_at, deleted_at) VALUES
(10, 4, 'math', 'red', '2025-06-03 21:17:48.383896+00', '2025-06-06 17:28:25.913386+00'),
(11, 4, 'new tag...', 'red', '2025-06-06 19:25:17.771144+00', '2025-06-06 17:28:01.494155+00'),
(12, 4, 'hello', 'purple', '2025-06-06 19:27:54.822842+00', '2025-06-06 17:28:06.173732+00'),
(13, 4, 'new tag...', 'green', '2025-06-06 19:28:21.335041+00', '2025-06-06 17:28:31.917227+00'),
(14, 4, 'math2', 'red', '2025-06-06 19:31:48.129946+00', NULL),
(15, 4, 'rsm', 'purple', '2025-06-06 19:34:51.748771+00', NULL),
(16, 4, 'nb', 'green', '2025-06-06 19:35:45.056174+00', NULL),
(17, 4, 'foobar', 'red', '2025-06-06 20:10:55.553801+00', '2025-06-06 18:32:07.342688+00'),
(18, 4, 'aloha', 'green', '2025-06-06 20:14:44.523154+00', '2025-06-06 18:32:19.549462+00'),
(19, 4, 'new', 'purple', '2025-06-06 20:21:31.266198+00', '2025-06-06 18:32:24.985803+00'),
(20, 4, 'special', 'blue', '2025-06-06 20:24:16.458698+00', '2025-06-06 18:32:30.302032+00'),
(21, 4, 'testing', 'green', '2025-06-06 20:25:08.850076+00', NULL),
(22, 4, 'journal', 'orange', '2025-06-06 20:25:25.698095+00', NULL),
(23, 4, 'project', 'yellow', '2025-06-06 20:25:36.970088+00', '2025-06-06 18:32:39.558019+00'),
(24, 4, 'draft', 'gray', '2025-06-06 20:25:44.362089+00', '2025-06-06 18:32:44.070056+00'),
(25, 4, 'notes', 'purple', '2025-06-06 20:25:50.994088+00', NULL),
(26, 4, 'research', 'blue', '2025-06-06 20:26:00.114092+00', NULL),
(27, 4, 'ideas', 'yellow', '2025-06-06 20:26:06.434088+00', NULL)
ON CONFLICT (id) DO NOTHING;
-- Insert all files
INSERT INTO files (id, title, abstract, keywords, status, last_edited_at, created_at, doi, source, deleted_at, owner_id) VALUES (1, 'New File', '', 'sample, research, test', 'DRAFT', '2025-06-26 20:40:20.82035+00', '2025-06-03 21:01:16.695896+00', NULL, ':rsm:
# New File

The possibilities are *endless*!

::
', '2025-06-26 20:40:20.834965+00', 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO files (id, title, abstract, keywords, status, last_edited_at, created_at, doi, source, deleted_at, owner_id) VALUES (2, 'Title and a paragraph', 'This is the abstract of sample file 2.', 'example, science, test', 'UNDER_REVIEW', '2025-06-03 21:01:16.695896+00', '2025-06-03 21:01:16.695896+00', NULL, '        :rsm:
        # My Title

        Lorem ipsum.

        ::
        ', NULL, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO files (id, title, abstract, keywords, status, last_edited_at, created_at, doi, source, deleted_at, owner_id) VALUES (3, 'Title, Section, and ParagraphSample File 3', 'This is the abstract of sample file 3.', 'research, test, study', 'PUBLISHED', '2025-06-19 11:45:28.587378+00', '2025-06-03 21:01:16.695896+00', NULL, '        :rsm:

        Lorem ipsum.

        ## Section title

        Lorem ipsum.

        ::

        ::
        ', NULL, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO files (id, title, abstract, keywords, status, last_edited_at, created_at, doi, source, deleted_at, owner_id) VALUES (4, '', '', NULL, 'DRAFT', '2025-06-20 18:46:00.733545+00', '2025-06-03 21:02:07.272674+00', NULL, E':rsm:
  :title: Solutions to Atiyah and MacDonald


:author:
  :name: Leo Torres
  :email: leo@leotrs.com
::


:abstract:

  :paragraph:{:icon: star} We systematically solve the exercises in Atiyah and MacDonald using the RSM language.

::


# Rings and Ideals
  :icon: alert

:paragraph:{:icon: bookmark} In the following, :let: $A$ be a ring::.

:theorem:
  :title: Exercise 1
  :icon: heart

  :paragraph:{:icon: success} :let: $x \\in A$ :: and :assume: $x$ is nilpotent::.  :span: :prove:{:label:goal-1}
  that $1 + x$ is a unit of $A$. :: ::  :span: :prove:{:label:goal-2} that the sum of a
  nilpotent element and a unit is a unit. :: ::

  :paragraph:{:icon: star} This is a second paragraph in the theorem.

::

:proof:
  :icon: question

  :sketch:

    Let $x$ be a nilpotent element. Then $x^n = 0$ for some $n \\in N$.  Then

    $$
    (1 + x)(1 - x + x^2 - \\ldots + (-1)^n x^n) = 1 + (−1)^n x^{n+1} = 1
    $$

    Let $u$ be a unit.  Then, $u^{−1} x$ is still nilpotent, since $(u^{−1} x)^n =
    u^{−n} x^n = 0$.  Thus $1 + u^{−1} x$ is unit, thus $u + x$ is a unit.

  ::

  :step:
    :label: x-is-nilp

    :pick: $n \\in \\mathbb{N}$ :: :st: ${:label: nilpotency}x^n = 0$ ::.

    :p: Such an $n$ exists by definition of nilpotent. :: ::

  :step: We have

    $$
      :label: eqn-1-plus-x-is-unit
      :isclaim:
    (1 + x)(1 - x + x^2 - \\ldots + (-1)^n x^n) = 1 + (−1)^n x^{n+1} = 1
    $$

    :p: Multiplying the left-hand side directly yields the middle expression.  The term
    $(−1)^n x^{n+1}$ equals $0$, by :ref:x-is-nilp::.  :: ::

  :step: :ref:goal-1, Goal 1:: is :qed:.

    :p: By :ref:eqn-1-plus-x-is-unit::.  :: ::

  :step:
    :label: some-lbl

    To prove :ref:goal-2, Goal 2::, it :suffices: to :assume: $u \\in A$ :: where $u$ is
    a unit ::, and :prove: that $u + x$ is a unit. :: ::

  :step: :⊢: $u^{−1} x$ is nilpotent.::

    :p: Immediately from $(u^{−1} x)^n = u^{−n} x^n = 0$. :: ::

  :step: :⊢: $1 + u^{−1} x$ is unit.::

    :p: By :ref:goal-1, Goal 1::. :: ::

  :step: :⊢: $u + x$ is a unit.::

    :p: Because both $u$ and $1 + u^{-1} x$ are units, and the units are closed under multiplication. :: ::

  :step:

    :ref:goal-2, Goal 2:: is :qed:

    :p: By :ref:some-lbl::. :: ::

::


:definition:

  :let: $A$ be a ring :: and $x$ be an indeterminate.  :write: $A[x]$ for the ring of
  polynomials in variable $x$ with coefficients in $A$ ::.

::

:theorem:
  :title: Exercise 1.2

  :let: $A$ be a ring :: and :let: $A[x]$ be the corresponding ring of polynomials ::.
  :let: $a_0, a_1, \\ldots, a_n \\in A$ :: and :write: $f \\colon = a_0 + a_1 x + \\ldots + a_n
  x^n \\in A[x]$ ::.  Show that

  :enumerate:

    :-: :claim:{:label:unit-iff-unit-nilp} $f$ is a unit in $A[x]$ $\\iff$ $a_0$ is a unit in $A$
    and $a_1, \\ldots , a_n$ are nilpotent. ::

    :-: :claim:{:label:nilp-iff-nilp} $f$ is nilpotent $\\iff$ $a_0, a_1, \\ldots , a_n$ are nilpotent. ::

    :-: :claim:{:label:zerodiv-iff-zerodiv} $f$ is a zero-divisor $\\iff$ there exists $a \\neq 0$ in $A$ such that $af = 0$. ::

    % :-: :claim: if $f, g \\in A[x]$, then $fg$ is primitive $\\iff$ $f$ and $g$ are primitive. ::

  ::

::

:proof:

  :step: :claim: $f$ is a unit in $A[x]$ $\\iff$ $a_0$ is a unit in $A$ and $a_1, \\ldots , a_n$ are nilpotent. ::

    :p:

      :step: :claim: $\\Longrightarrow$ ::

        :p:

	  :step:
	    :label:asm-f-unit

	    :assume: $f$ is a unit in $A[x]$. ::

	  ::

	  :step: :pick: $g \\in A[x]$ :: :st: $fg = 1$ ::, and :write: $g = \\sum_{j=0}^m b_j x^j$ ::.

	    :p: Such a $g$ exists because $f$ is a unit, as assumed in :prev:. :: ::

	  :step: :write: $fg = \\sum_k c_k x^k$ :: and observe :claim: $c_k = \\sum_{r=0}^k a_r b_{k - r}$ ::.

	    :p: By direct computation of the product $fg$. :: ::

	  :step:
	    :label:ck-is-zero

	    :claim: $c_0 = 1$ and $c_k = 0$ for each $k > 1$ ::.

	    :p: From the fact that $fg = 1$. :: ::

	  :step:
	    :label:a0-b0-are-units

	    :claim: $a_0$ and $b_0$ are units in $A$. ::

	    :p: Because $1 = c_0 = a_0 b_0$. :: ::

	  :step: :claim: $a_1, \\ldots , a_n$ are nilpotent. ::

	    :p:

	      :step:
	        :label:first-substep

	        :claim: $a^r_n b_{m+1-r} = 0$ for $r = 1, \\ldots, m + 1$. ::

	        :p:

	          :step: We proceed by induction.  For the base case $r=1$, we have $a_n
	          b_m = 0$ which is true because $a_n b_m = c_{n+m} = 0$, from
	          :ref:ck-is-zero::. ::

	          :step: :assume:{:label:ind-hyp} $a^s_n b_{m+1-s} = 0$ for each $ s = 1, \\ldots, r$ ::. ::

	          :step: :claim: $a^{r+1}_n b_{m-r} = 0$ ::

	            :p:

	              Consider $0 = a_n^r c_{m+n-r}$,

	              $$
	              \\begin{align}
	              0 &= a_n^r \\big( b_{m-r}a_n + b_{m-r+1}a_{n-1} + \\ldots + b_m a_{n-r} \\big) \\\\
                      0 &= a_n^{r+1} b_{m-r} + (a_n^r b_{m-r+1}) a_n a_{n-1} + \\ldots + (a_n b_m) a_n^{r-1} a_{n-r} \\\\
                      0 &= a_n^{r+1} b_{m-r},
                      \\end{align}
	              $$

	              where the quantities in parentheses in the second equation each
	              individually equal zero due to the :ref:ind-hyp, induction hypothesis.::

	            :: :: :: ::

	      :step: :qed:

	        :p:

	          :step: We again proceed by induction.  To prove the base case that
	          $a_n$ is nilpotent, observe $a_n^{m+1} b_0 = 0$ by
	          :ref:first-substep::.  However, $b_0$ is a unit by
	          :ref:a0-b0-are-units:: and thus $a_n$ is nilpotent. ::

	          :step: :assume: $a_r$ is nilpotent for each $r = r, \\ldots, n$. :: ::

	          :step: :claim: $a_{r-1}$ is nilpotent ::.

	            :p:

	              :step: :claim: $a_n x^n + a_{n-1} x^{n-1} + \\ldots + a_r x^r $ is nilpotent. ::

	        	:p: By inductive hypothesis, and the fact that the nilpotent
	        	elements are closed under addition. :: ::

	              :step: :claim: $f - (a_n x^n + a_{n-1} x^{n-1} + \\ldots + a_r x^r)$ is a unit.::

	        	:p: By Exercise 1, since $f$ is a unit, and the term in parenthesis is nilpotent. :: ::

	              :step: :qed:

	        	:p: Applying THE SAME ARGUMENT to $f - (a_n x^n + a_{n-1}
	        	x^{n-1} + \\ldots + a_r x^r)$, we find that its leading
	        	coefficient, namely $a_{r-1}$, is nilpotent. :: ::

	            :: ::

	        :: ::

	    :: ::

	:: ::

      :step: :claim: $\\Longleftarrow$ ::

        :p:

          :step: :assume:{:label:asm-1} $a_0$ is a unit in $A$, and $a_1, \\ldots, a_n$ are nilpotent. :: ::

          :step: :claim: Each $a_1 x, a_2 x^2, \\ldots, a_n x^n$ is nilpotent. ::

            :p: Immediate from the fact that the $a_1, \\ldots, a_n$ are nilpotent. :: ::

          :step: :write: $u \\colon = \\sum_{i=1}^{n} a_i x^i $. :: ::

          :step:
            :label: u-is-unit

            :claim: $u$ is nilpotent. ::

            :p: Since each of the terms $a_i x^i$ for $i=1,\\ldots,n$ is nilpotent, and
            the nilpotent elements are closed under addition. :: ::

          :step: :claim: $f$ is a unit in $A[x]$. ::

            :p: Writing $f = a_0 + u $, we can see that $f$ is the sum of a unit (namely
            $a_0$, by :ref:asm-1, assumption::) and a nilpotent element (namely $u$, by
            :prev:).  :ref:sum-nilp-unit-is-unit:: implies that $f$ is a unit. :: ::

            ::
        ::

    ::

  ::

  :step: :claim: $f$ is nilpotent $\\iff$ $a_0, a_1, \\ldots , a_n$ are nilpotent. ::

    :p:

      :step: :claim: $\\Longrightarrow$ ::

        :p:

          :step: :pick: $m \\in \\mathbb{N}$ :: :st: $f^m = 0$ ::. ::

          :step: We proceed by induction.  For the base case, we have that :claim: $a_n$ is nilpotent in $A$::.

            :p: Note the leading coefficient of $f^m$ is $a_n^m$.  It has to equal $0$
            because $f = 0$. :: ::

          :step: :assume: $a_s$ is nilpotent for each $s = n, \\ldots, r.$ :: ::

          :step: :claim: $a_{r-1}$ is nilpotent.::

            :p: Note $g := f - (a_n x^n + \\ldots + a_r x^r)$ is nilpotent since both $f$ and
            the term in parenthesis are nilpotent.  By THE PREVIOUS ARGUMENT, the
            leading coefficient of $g$, namely $a_{r-1} x^{r-1}$, is nilpotent in
            $A[x]$, which in turn implies $a_{r-1}$ is nilpotent in $A$. :: ::

        ::
      ::

      :step: :claim: $\\Longleftarrow$ ::

        :p: Since $a_k$ is nilpotent then $a_k x^k$ is nilpotent, for each $k = 1,
        \\ldots, n$.  The sum $f = \\sum a_k x^k$ is nilpotent since the nilpotent
        elements are closed under addition. :: ::


    :: ::

::

:bibliography: ::

::

:bibtex:

@book{atiyah2018introduction,
  title={Introduction to commutative algebra},
  author={Atiyah, M.F., & MacDonald, I.G.},
  year={2018},
  publisher={CRC Press},
  doi={https://doi.org/10.1201/9780429493638},
}

::
', '2025-06-20 18:46:00.738623+00', 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO files (id, title, abstract, keywords, status, last_edited_at, created_at, doi, source, deleted_at, owner_id) VALUES (5, 'Exercise 1', '', NULL, 'DRAFT', '2025-06-11 16:32:58.89654+00', '2025-06-03 21:02:07.299552+00', NULL, E':rsm:

# Exercise 1

## Section one

:pick: $g \\in A[x]$ :: :st: $fg = 1$. ::

:theorem:

  :claim: All $X$ are $Y$ ::.

::

:proof:

  :step: By some definition, we have
    $$
      2+2 = 4,
    $$
    as we said before.

    :p:

      :step: And this is the proof of that fact. ::

      :step: And another step. ::

    ::

  ::

::

::
', NULL, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO files (id, title, abstract, keywords, status, last_edited_at, created_at, doi, source, deleted_at, owner_id) VALUES (6, 'New handrails are cool', '', NULL, 'DRAFT', '2025-06-12 18:18:03.795102+00', '2025-06-03 21:02:07.301078+00', NULL, ':rsm:
# New handrails are cool

## Icons
  :label: sec-one
  :icon: heart

:paragraph: {:icon: star} Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed
do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,
quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

:theorem:
  :icon: question

  This is the statement of the theorem, and it contains math!
  $$
  2+2=4.
  $$
  This is the same paragraph.

  :paragraph: {:icon: alert} And here is another one paragraph that does not have math
  within it.

  And another $2+2=4$.

::
', NULL, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO files (id, title, abstract, keywords, status, last_edited_at, created_at, doi, source, deleted_at, owner_id) VALUES (7, 'RSM Markup', '', NULL, 'DRAFT', '2025-06-12 18:00:30.546068+00', '2025-06-03 21:02:07.302192+00', NULL, ':rsm:
# RSM Markup

:author:
  :name: Melvin J. Blanc
  :affiliation: ACME University
  :email: mel@acme.edu
::

:abstract:

 Web-first scientific manuscripts. Foo bar baz.Foo bar baz.Foo bar baz.Foo bar baz.Foo
  bar baz.Foo bar baz.Foo bar baz.Foo bar baz.Foo bar baz.Foo bar baz.  Foo bar baz.Foo
  bar baz.Foo bar baz.Foo bar baz.Foo bar baz.Foo bar baz.Foo bar baz.Foo bar baz.Foo
  bar baz.Foo bar baz.Foo bar baz.Foo bar baz.Foo bar baz.Foo bar baz.Foo bar baz.Foo
  bar baz.Foo bar baz.Foo bar baz.Foo bar baz.Foo bar baz.Foo bar baz.Foo bar baz.Foo
  bar baz.


  Foo bar baz.Foo bar baz.Foo bar baz.Foo bar baz.Foo bar baz.Foo bar baz.Foo bar
      baz.Foo bar baz.

::

## Awesome

  Simple markup for :span:{:strong:, :emphas:}
 web native:: scientific publications. Foo bar baz. Foo bar baz. Foo bar baz. Foo
  bar baz. Foo bar baz.

::
', NULL, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO files (id, title, abstract, keywords, status, last_edited_at, created_at, doi, source, deleted_at, owner_id) VALUES (8, 'Solutions to Atiyah and MacDonald', '', NULL, 'DRAFT', '2025-06-21 14:44:04.239034+00', '2025-06-03 21:02:07.303358+00', NULL, E':rsm:
# Solutions to Atiyah and MacDonald


:author:
  :name: Leo Torres
  :email: leo@leotrs.com
::


:abstract:

  We systematically solve the exercises in Atiyah and MacDonald
  :cite:atiyah2018introduction:: using the RSM language.

::

:toc:


## Rings and Ideals
  :label: ch-1

:paragraph: {:title: Foobar} In the following, :let: $A$ be a ring::.

:theorem:
  :title: Exercise 1
  :label: sum-nilp-unit-is-unit

  :let: $x \\in A$ :: and :assume: $x$ is nilpotent::.  :span: :prove:{:label:goal-1}
  that $1 + x$ is a unit of $A$. :: ::  :span: :prove:{:label:goal-2} that the sum of a
  nilpotent element and a unit is a unit. :: ::

::

:sketch:

  Let $x$ be a nilpotent element. Then $x^n = 0$ for some $n \\in N$.  Then
  $$
  :nonum:
  (1 + x)(1 - x + x^2 - \\ldots + (-1)^n x^n) = 1 + (−1)^n x^{n+1} = 1
  $$

  Let $u$ be a unit.  Then, $u^{−1} x$ is still nilpotent, since $(u^{−1} x)^n =
  u^{−n} x^n = 0$.  Thus $1 + u^{−1} x$ is unit, thus $u + x$ is a unit.

::

:proof:

  :step:
    :label: x-is-nilp

    :pick: $n \\in \\mathbb{N}$ :: :st: ${:label: nilpotency}x^n = 0$ ::.

    :p: Such an $n$ exists by definition of nilpotent. :: ::

  :step: We have
    $$
      :label: eqn-1-plus-x-is-unit
    (1 + x)(1 - x + x^2 - \\ldots + (-1)^n x^n) = 1 + (−1)^n x^{n+1} = 1
    $$

    :p: Multiplying the left-hand side directly yields the middle expression.  The term
    $(−1)^n x^{n+1}$ equals $0$, by :ref:x-is-nilp::.  :: ::

  :step: :ref:goal-1, Goal 1:: is :qed:.

    :p: By :ref:eqn-1-plus-x-is-unit::.  :: ::

  :step:
    :label: some-lbl

    To prove :ref:goal-2, Goal 2::, it :suffices: to :assume: $u \\in A$ :: where $u$ is
    a unit ::, and :prove: that $u + x$ is a unit. :: ::

  :step: :⊢: $u^{−1} x$ is nilpotent.::

    :p: Immediately from $(u^{−1} x)^n = u^{−n} x^n = 0$. :: ::

  :step: :⊢: $1 + u^{−1} x$ is unit.::

    :p: By :ref:goal-1, Goal 1::. :: ::

  :step: :⊢: $u + x$ is a unit.::

    :p: Because both $u$ and $1 + u^{-1} x$ are units, and the units are closed under multiplication. :: ::

  :step:

    :ref:goal-2, Goal 2:: is :qed:.

    :p: By :ref:some-lbl::. :: ::

::


:definition:

  :let: $A$ be a ring :: and $x$ be an indeterminate.  :write: $A[x]$ for the ring of
  polynomials in variable $x$ with coefficients in $A$ ::.

::

:theorem:
  :title: Exercise 1.2
  :icon: heart

  :let: $A$ be a ring :: and :let: $A[x]$ be the corresponding ring of polynomials ::.
  :let: $a_0, a_1, \\ldots, a_n \\in A$ :: and :write: $f \\colon = a_0 + a_1 x + \\ldots + a_n
  x^n \\in A[x]$ ::.  Show that

  :enumerate:

    :-: :claim:{:label:unit-iff-unit-nilp} $f$ is a unit in $A[x]$ $\\iff$ $a_0$ is a unit in $A$
    and $a_1, \\ldots , a_n$ are nilpotent. ::

    :-: :claim:{:label:nilp-iff-nilp} $f$ is nilpotent $\\iff$ $a_0, a_1, \\ldots , a_n$ are nilpotent. ::

    :-: :claim:{:label:zerodiv-iff-zerodiv} $f$ is a zero-divisor $\\iff$ there exists $a \\neq 0$ in $A$ such that $af = 0$. ::

    % :-: :claim: if $f, g \\in A[x]$, then $fg$ is primitive $\\iff$ $f$ and $g$ are primitive. ::

  ::

::

:proof:  :icon: heart

  :step: :claim: $f$ is a unit in $A[x]$ $\\iff$ $a_0$ is a unit in $A$ and $a_1, \\ldots , a_n$ are nilpotent. ::

    :p:

      :step: :claim: $\\Longrightarrow$ ::

        :p:

	  :step:
	    :label:asm-f-unit

	    :assume: $f$ is a unit in $A[x]$. ::

	  ::

	  :step: :pick: $g \\in A[x]$ :: :st: $fg = 1$ ::, and :write: $g = \\sum_{j=0}^m b_j x^j$ ::.

	    :p: Such a $g$ exists because $f$ is a unit, as assumed in :prev:. :: ::

	  :step: :write: $fg = \\sum_k c_k x^k$ :: and observe :claim: $c_k = \\sum_{r=0}^k a_r b_{k - r}$ ::.

	    :p: By direct computation of the product $fg$. :: ::

	  :step:
	    :label:ck-is-zero

	    :claim: $c_0 = 1$ and $c_k = 0$ for each $k > 1$ ::.

	    :p: From the fact that $fg = 1$. :: ::

	  :step:
	    :label:a0-b0-are-units

	    :claim: $a_0$ and $b_0$ are units in $A$. ::

	    :p: Because $1 = c_0 = a_0 b_0$. :: ::

	  :step: :claim: $a_1, \\ldots , a_n$ are nilpotent. ::

	    :p:

	      :step:
		:label:first-substep

		:claim: $a^r_n b_{m+1-r} = 0$ for $r = 1, \\ldots, m + 1$. ::

		:p:

		  :step: We proceed by induction.  For the base case $r=1$, we have $a_n
		  b_m = 0$ which is true because $a_n b_m = c_{n+m} = 0$, from
		  :ref:ck-is-zero::. ::

		  :step: :assume:{:label:ind-hyp} $a^s_n b_{m+1-s} = 0$ for each $ s = 1, \\ldots, r$ ::. ::

		  :step: :claim: $a^{r+1}_n b_{m-r} = 0$ ::

		    :p: Consider $0 = a_n^r c_{m+n-r}$,
		      $$
		      \\begin{align}
		      0 &= a_n^r \\big( b_{m-r}a_n + b_{m-r+1}a_{n-1} + \\ldots + b_m a_{n-r} \\big) \\\\
                      0 &= a_n^{r+1} b_{m-r} + (a_n^r b_{m-r+1}) a_n a_{n-1} + \\ldots + (a_n b_m) a_n^{r-1} a_{n-r} \\\\
                      0 &= a_n^{r+1} b_{m-r},
                      \\end{align}
		      $$
		      where the quantities in parentheses in the second equation each
		      individually equal zero due to the :ref:ind-hyp, induction hypothesis.::

		    :: :: :: ::

	      :step: :qed:

		:p:

		  :step: We again proceed by induction.  To prove the base case that
		  $a_n$ is nilpotent, observe $a_n^{m+1} b_0 = 0$ by
		  :ref:first-substep::.  However, $b_0$ is a unit by
		  :ref:a0-b0-are-units:: and thus $a_n$ is nilpotent. ::

		  :step: :assume: $a_r$ is nilpotent for each $r = r, \\ldots, n$. :: ::

		  :step: :claim: $a_{r-1}$ is nilpotent ::.

		    :p:

		      :step: :claim: $a_n x^n + a_{n-1} x^{n-1} + \\ldots + a_r x^r $ is nilpotent. ::

			:p: By inductive hypothesis, and the fact that the nilpotent
			elements are closed under addition. :: ::

		      :step: :claim: $f - (a_n x^n + a_{n-1} x^{n-1} + \\ldots + a_r x^r)$ is a unit.::

			:p: By :ref:sum-nilp-unit-is-unit,Exercise 1::, since $f$ is a
			unit, and the term in parenthesis is nilpotent. :: ::

		      :step: :qed:

			:p: Applying THE SAME ARGUMENT to $f - (a_n x^n + a_{n-1}
			x^{n-1} + \\ldots + a_r x^r)$, we find that its leading
			coefficient, namely $a_{r-1}$, is nilpotent. :: ::

		    :: ::

		:: ::

	    :: ::

	:: ::

      :step: :claim: $\\Longleftarrow$ ::

        :p:

	  :step: :assume:{:label:asm-1} $a_0$ is a unit in $A$, and $a_1, \\ldots, a_n$ are nilpotent. :: ::

	  :step: :claim: Each $a_1 x, a_2 x^2, \\ldots, a_n x^n$ is nilpotent. ::

	    :p: Immediate from the fact that the $a_1, \\ldots, a_n$ are nilpotent. :: ::

	  :step: :write: $u \\colon = \\sum_{i=1}^{n} a_i x^i $. :: ::

	  :step:
	    :label: u-is-unit

	    :claim: $u$ is nilpotent. ::

	    :p: Since each of the terms $a_i x^i$ for $i=1,\\ldots,n$ is nilpotent, and
	    the nilpotent elements are closed under addition. :: ::

	  :step: :claim: $f$ is a unit in $A[x]$. ::

	    :p: Writing $f = a_0 + u $, we can see that $f$ is the sum of a unit (namely
	    $a_0$, by :ref:asm-1, assumption::) and a nilpotent element (namely $u$, by
	    :prev:).  :ref:sum-nilp-unit-is-unit:: implies that $f$ is a unit. :: ::

	:: ::

    ::

  ::

  :step: :claim: $f$ is nilpotent $\\iff$ $a_0, a_1, \\ldots , a_n$ are nilpotent. ::

    :p:

      :step: :claim: $\\Longrightarrow$ ::

	:p:

	  :step: :pick: $m \\in \\mathbb{N}$ :: :st: $f^m = 0$ ::. ::

	  :step: We proceed by induction.  For the base case, we have that :claim: $a_n$ is nilpotent in $A$::.

	    :p: Note the leading coefficient of $f^m$ is $a_n^m$.  It has to equal $0$
	    because $f = 0$. :: ::

	  :step: :assume: $a_s$ is nilpotent for each $s = n, \\ldots, r.$ :: ::

	  :step: :claim: $a_{r-1}$ is nilpotent.::

	    :p: Note $g := f - (a_n x^n + \\ldots + a_r x^r)$ is nilpotent since both $f$ and
	    the term in parenthesis are nilpotent.  By THE PREVIOUS ARGUMENT, the
	    leading coefficient of $g$, namely $a_{r-1} x^{r-1}$, is nilpotent in
	    $A[x]$, which in turn implies $a_{r-1}$ is nilpotent in $A$. :: ::

	:: ::

      :step: :claim: $\\Longleftarrow$ ::

	:p: Since $a_k$ is nilpotent then $a_k x^k$ is nilpotent, for each $k = 1,
        \\ldots, n$.  The sum $f = \\sum a_k x^k$ is nilpotent since the nilpotent
        elements are closed under addition. :: ::

    :: ::

::


:bibliography: ::

::


:bibtex:

@book{atiyah2018introduction,
  title={Introduction to commutative algebra},
  author={Atiyah, M.F., & MacDonald, I.G.},
  year={2018},
  publisher={CRC Press},
  doi={https://doi.org/10.1201/9780429493638},
}

::
', NULL, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO files (id, title, abstract, keywords, status, last_edited_at, created_at, doi, source, deleted_at, owner_id) VALUES (9, '', '', NULL, 'DRAFT', '2025-06-20 18:45:58.537422+00', '2025-06-03 21:02:07.304805+00', NULL, ':rsm:
# Some Title

## Section

Hello.

::
', '2025-06-20 18:45:58.62367+00', 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO files (id, title, abstract, keywords, status, last_edited_at, created_at, doi, source, deleted_at, owner_id) VALUES (10, 'Indefinite Linear Algebra of the NBM', '', NULL, 'DRAFT', '2025-06-12 14:17:16.311344+00', '2025-06-03 21:02:07.306003+00', NULL, E':rsm:
# Indefinite Linear Algebra of the NBM
  :date: 2024-04-13


:author:
  :name: Leo Torres
  :email: leo@leotrs.com
::


:paragraph: {:types: hide} preamble
$$
  :nonum:
\\newcommand{\\into}[2]{{\\vec{\\mathbf{#1}}}^{{#2}}}
\\newcommand{\\from}[2]{{{}}^{{#2}}{\\vec{\\mathbf{#1}}}}
\\newcommand{\\mb}[1]{\\mathbf{#1}}
$$


:abstract:

  We study the properties of the NBM of a graph that come from its particular symmetry.
  We systematically follow :cite:thebook::.

::


:toc:


## Introduction
  :label: sec-intro

:let: $G$ be an undirected, simple graph :: and :let: $m$ be the number of edges in
$G$::.  :write: $E$ for the set of edges of $G$ and $\\vec{E}$ for the set of directed
edges of $G$::, i.e. where each undirected edge $i-j \\in E$ corresponds to two directed
edges $i \\to j, j \\to i \\in \\vec{E}$.  :let: $\\mb{B}$ be the /non-backtracking/ (or
simply /NB/) operator of $G$::.  That is to say, $\\mb{B}$ is an operator in the
space $\\mathbb{C}^{\\vec{E}}$ defined by $$ \\left( \\mb{B} \\mb{v} \\right)_{i \\to
j} = \\sum_{k \\to i \\in \\vec{E}} \\mb{v}_{k \\to i} - \\mb{v}_{j \\to i}.  $$

In order to see $\\mb{B}$ as a matrix, we will identify the space of functions
$\\mathbb{C}^{\\vec{E}}$ with the complex vector space $\\mathbb{C}^{2m}$, with components
ordered as follows.  Choose an arbitrary orientation for the $m$ undirected edges of
$G$, and order them in some arbitrary way.  These correspond to the first $m$
coordinates in $\\mathbb{C}^{2m}$.  The second $m$ coordinates correspond to the opposite
orientation of the edges sorted in the same order.

:remark:

  In the rest of these notes, we will consider $\\mb{B}$ as an operator in
  $\\mathbb{C}^{\\vec{E}}$ or as a matrix acting in $\\mathbb{C}^{2m}$ interchangeably, as
  convenient.  Accordingly, we will write a function $\\mb{v} \\colon
  \\mathbb{C}^{\\vec{E}} \\to \\mathbb{C}$ with components $\\mb{v}_{i \\to j}$ for $i \\to
  j \\in \\vec{E}$, and identify it with the vector $\\mb{v} \\in \\mathbb{C}^{2m}$ with
  components $\\mb{v}_r$ for $r \\in \\{ 1, \\ldots, 2m \\}$.  The order of the
  components will always be the same, unless stated otherwise.

::

$\\mb{B}$ is not Hermitian, however it does have some symmetry.  There exists an
operator $\\mb{P}$ such that
$$
\\mb{BP} = \\mb{P} \\mb{B}^*.
$$
We call this matrix /the flip operator/ or simply /the flip/ of $G$.  The flip is
defined as
$$
  :label: flip-defn
(\\mb{Pv})_{i \\to j} = \\mb{v}_{j \\to i},
$$
for any $\\mb{v} \\in \\mathbb{C}^{\\vec{E}}$.  This explains where the name /flip/
comes from\\: $\\mb{P}$ acts by flipping the orientation of each edge.  Moreover, when
the rows and columns of the matrix $\\mb{B}$ are ordered in the usual way, we can
write
$$
  :label: flip-blocks

\\mb{P} = \\left(
\\begin{array}
\\,\\mb{0} & \\mb{I} \\\\
\\mb{I} & \\mb{0}
\\end{array}
\\right),
$$
where $\\mb{0}$ and $\\mb{I}$ are the zero matrix and the identity matrix,
respectively, in $\\mathbb{C}^{m \\times m}$.  Concretely, $\\mb{P}$ swaps the $i$-th
and $(m+i)$-th coordinates with each other.


From now on, we :let: $\\mb{P}$ be the flip of $G$ ::.

:remark: Even though both $\\mb{B}$ and $\\mb{P}$ have all real coefficients, we
  will consider them as transformations on a complex space.  The reason is that the
  eigenvalues of $\\mb{B}$ are in general complex numbers.  Thus, we will discuss
  their properties with the language appropriate to complex spaces.  For example, we
  will say that $\\mb{P}$ is /unitary/ rather than /orthogonal/.
::

:paragraph: {:label:flip-evectors, :title: A definition} :write: $\\mb{v}^i :=
\\langle \\ldots, 1, \\ldots, 0, \\ldots, 1, \\ldots, 0 \\rangle$, the vector with a $1$ in
the /i/-th and /(m+i)/-th components, for each $i = 1, \\ldots, m$::.  Similarly, :write:
$\\mb{v}^{-i} := \\langle \\ldots, 1, \\ldots, 0, \\ldots, -1, \\ldots, 0 \\rangle$, the
vector with a $1$ in the /i/-th component and a $-1$ in the /(m+i)/-th component, for
each $i = 1, \\ldots, m$::.

:proposition:
  :title: Properties of the flip
  :label: prop-flip

  :claim: The flip $\\mb{P}$ is involutory, invertible, Hermitian, and unitary ::.
  Furthermore, :claim: $\\left\\{ \\mb{v}^{i} \\right\\}_{i=1}^m \\cup \\left\\{
  \\mb{v}^{-i} \\right\\}_{i=1}^m$ make a complete basis of eigenvectors of
  $\\mb{P}$ ::.

::

:proof:

  :step: :claim: The flip $\\mb{P}$ is involutory, invertible, Hermitian, and unitary ::.

    :p: Direct computation using :ref:flip-defn:: yields $\\mb{P}^2 = \\mb{I}$,
    which in turn means it is its own inverse.  :ref:flip-blocks:: means $\\mb{P}$ is
    Hermitian. All Hermitian involutory matrices are unitary. :: ::

  :step: :claim: $\\left\\{ \\mb{v}^{i} \\right\\}_{i=1}^m \\cup \\left\\{ \\mb{v}^{-i}
  \\right\\}_{i=1}^m$ make a complete basis of eigenvectors of $\\mb{P}$ ::

    :p:

      :step: :claim: $\\mb{P} \\mb{v}^i = \\mb{v}^i$ and $\\mb{P}
      \\mb{v}^{-i} = -\\mb{v}^i$::. ::

      :step: :claim: The vectors $\\left\\{ \\mb{v}^{i} \\right\\}_{i=1}^m \\cup \\left\\{
	\\mb{v}^{-i} \\right\\}_{i=1}^m$ are all linearly independent. :: ::

    ::

  ::

::

:remark: In the rest of these notes, each section and subsection is numbered according
to the chapters and sections of :cite:thebook::.  ::



## Indefinite Inner Products
:label: sec-indefinite-inner-products


### Definition
:label: sec-definition

Since every invertible Hermitian matrix defines an indefinite inner product,
$\\mb{P}$ defines one too.  For two vectors $\\mb{x}, \\mb{y} \\in
\\mathbb{C}^{2m}$, we have
$$
[\\mb{x}, \\mb{y}]_\\mb{P} := \\mb{x}^{\\top} \\mb{P} \\overline{\\mb{y}} = \\sum_{i \\to j} \\mb{x}_{i \\to j} \\, \\overline{\\mb{y}_{j \\to i}}.
$$

When rows and columns are ordered in the usual way, we equivalently have
$$
\\mb{x}^{\\top} \\mb{P} \\overline{\\mb{y}} = \\sum_{r=1}^{2m} \\mb{x}_{r} \\, \\overline{\\mb{y}_{m + r}},
$$
where the subscript $m+r$ is taken modulo $2m$.

:remark: Usually, the complex inner product is written with the complex conjugate in the
first argument, as $\\mb{x}^* \\mb{P} \\mb{y}$.  Unfortunately, the authors of
:cite:thebook:: choose to use it on the second argument, $\\mb{x}^{\\top} \\mb{P}
\\overline{\\mb{y}}$, as shown above.  Since we are following them closely, we choose
to use their notation.::


#### The flip and the sip
:label: sec-flip-sip
:nonum:

The book :cite:thebook:: repeatedly uses the so-called /sip/ matrix (short for /standard
involutory permutation/), defined as the $n \\times n$ matrix with
$$
\\mb{S}_n =
\\left[
\\begin{array}
\\,0 & 0 & \\ldots & 0 & 1 \\\\
0 & 0 & \\ldots & 1 & 0 \\\\
\\vdots & \\vdots & \\ddots & \\vdots & \\vdots \\\\
0 & 1 & \\ldots & 0 & 0 \\\\
1 & 0 & \\ldots & 0 & 0
\\end{array}
\\right].
$$

In our case, the $\\mb{P}$ matrix would be exactly equal to $\\mb{S}_{2m}$ if we
had ordered the oriented edges in a different way.  Specifically, after fixing the
orientation of the edges of $G$ and placing them as the first $m$ components, if we
place the next $m$ components /in the reverse order/, then $\\mb{P}$ would equal
$\\mb{S}_{2m}$.  Since the order of the oriented edges is arbitrary, all properties
of the sip matrix are shared by the flip, both as operators or as matrices.  With this
in mind, we will continue to use $\\mb{P}$ and the oriented edge order defined above.


### Orthogonality and Orthogonal Bases
:label: sec-orthogonality

Following example 2.2.1 in :cite:thebook::, we look for a subspace $\\mathcal{M}$ whose
$\\mb{P}$-orthogonal companion is not its direct complement.  :let: $\\alpha \\to
\\beta$ be an arbitrary edge ::, and :let: $\\mathcal{M}$ be the subspace spanned by
$\\mb{e}_{\\alpha \\to \\beta}$::. Then
$$
\\left[\\mb{e}_{\\alpha \\to \\beta}, \\mb{y} \\right]_\\mb{P}
=
\\sum_{i \\to j} \\left(\\mb{e}_{\\alpha \\to \\beta}\\right)_{i \\to j} \\, \\overline{\\mb{y}_{j \\to i}}
=
\\overline{\\mb{y}_{\\beta \\to \\alpha}}.
$$

If $\\mb{y}$ is $\\mb{P}$-orthogonal to $\\mb{e}_{\\alpha \\to \\beta}$ then it
must satisfy $\\mb{y}_{\\beta \\to \\alpha} = 0$.  Thus
$\\mathcal{M}^{[\\bot]_{\\mb{P}}}$ is spanned by $\\{ \\mb{e}_{i \\to j} \\colon i \\to
j \\neq \\beta \\to \\alpha \\}$.  Note this set contains $\\mb{e}_{\\alpha \\to \\beta}$
itself.

According to Proposition 2.2.2 of :cite:thebook::, this is due to the fact that this
particular $\\mathcal{M}$ is degenerate.  Indeed, :claim: $\\left[\\mb{e}_{\\alpha \\to
\\beta}, z \\mb{e}_{\\alpha \\to \\beta} \\right]_\\mb{P} = 0$, for any $z \\in
\\mathbb{C}$ ::, but $\\mb{e}_{\\alpha \\to \\beta}$ is obviously not zero.

:draft: What about the subspace corresponding to the unit eigenvalues of $\\mb{B}$? ::


#### P-Orthogonal basis
:label: sec-p-orthogonal-basis
:nonum:

The canonical basis of $\\mathbb{C}^{2m}$ is not $\\mb{P}$-orthonormal.  Indeed,
$\\left[ \\mb{e}_{i \\to j}, \\mb{e}_{i \\to j} \\right]_\\mb{P} = 0$ for any edge
$i \\to j$.  Instead, we can use the basis of eigenvectors of $\\mb{P}$ exhibited
:ref:flip-evectors, previously::.  Observe we have, for every $i \\in \\left\\{ -m, \\ldots,
-1, 1, \\ldots, m \\right\\}$, $$ \\left[ \\mb{v}^i, \\mb{v}^i \\right]_\\mb{P} =
\\sum_{r=1}^{2m} \\mb{v}^i_r \\overline{\\mb{v}^i_{m+r}} = \\mb{v}_i^i
\\mb{v}_{m+i}^i + \\mb{v}_{m+i}^i \\mb{v}_{i}^i = \\begin{cases} - 2, & i \\in
\\left\\{ -m, \\ldots, -1 \\right\\} \\\\ \\phantom{-} 2, & i \\in \\left\\{ 1, \\ldots, m
\\right\\}. \\\\ \\end{cases} $$

Additionally,
$$
\\begin{align}
\\left[\\mb{v}^i, \\mb{v}^j\\right]_\\mb{P}
&=
0,
\\text{ for each } i \\in \\{-m, \\ldots, -1, 1, \\ldots, m\\} \\text{ and each } j \\neq -i, \\\\
\\left[\\mb{v}^i, \\mb{v}^{-i} \\right]_\\mb{P}
&=
\\sum_{r=1}^{2m} \\mb{v}^i_r \\overline{\\mb{v}^{-i}_{m+r}}
=
\\mb{v}_i^i \\mb{v}_{m+i}^{-i} + \\mb{v}_{m+i}^i \\mb{v}_{i}^{-i}
= -1 + 1 = 0.
\\end{align}
$$
Therefore, the set $\\left\\{ \\frac{\\mb{v}^i}{\\sqrt{2}} \\colon i = -m,
\\ldots, -1, 1, \\ldots, m \\right\\}$ is a $\\mb{P}$-orthonormal basis.

Moreover, this basis is also orthogonal in the standard sense, which comes from the fact
that they are the eigenvectors of $\\mb{P}$.  Still, we have the following
computation,
$$
\\begin{align}
\\left(\\mb{v}^i\\right)^* \\mb{v}^i
&=
\\sum_{r=1}^{2m} \\overline{\\mb{v}^i_r} \\mb{v}^i_{r}
=
\\overline{\\mb{v}^i_i} \\mb{v}^i_i + \\overline{\\mb{v}^i_{m+i}} \\mb{v}^i_{m+i} \\\\
&=
1 + 1
=
2,
\\text{ for each } i \\in \\{1, \\ldots, m\\} \\\\
&=
\\left(-1\\right)^2 + \\left(-1\\right)^2
=
2,
\\text{ for each } i \\in \\{-m, \\ldots, -1\\} \\\\
\\left(\\mb{v}^i\\right)^* \\mb{v}^j
&=
\\sum_{r=1}^{2m} \\overline{\\mb{v}^i_r} \\mb{v}^j_{r} \\\\
&=
0,
\\text{ for each } i \\neq m + j \\\\
&=
1(1) + 1(-1) = 0,
\\text{ for each } i = m + j. \\\\
\\end{align}
$$


### Classification of Subspaces
:label: sec-classification-of-subspaces


### Exercises
:label: sec-exercises

The goal of most of the exercises in this section revolves around finding subspaces with
certain properties (neutral, positive, non-negative, etc) for a given indefinite inner
product.  We do so here for the flip $\\mb{P}$.

Consider an arbitrary vector $\\mb{z}$ written in the $\\mb{P}$-orthogonal basis
described :ref:flip-evectors, above:: as $\\mb{z} = \\sum_{r=1}^m \\left(\\zeta_r
\\mb{v}^r + \\zeta_{-r} \\mb{v}^{-r} \\right)$.  In this case we have
$$
:label: eqn-product-basis
\\begin{align}
\\left[\\mb{z}, \\mb{z} \\right]_\\mb{P}
&=
\\sum_{r=1}^m \\sum_{s=1}^m \\left[ \\zeta_r \\mb{v}^r + \\zeta_{-r}\\mb{v}^{-r}, \\zeta_s\\mb{v}^{s} + \\zeta_{-s}\\mb{v}^{-s} \\right]_{\\mb{P}} \\\\
&=
\\sum_{r=1}^m \\sum_{s=1}^m \\left(
 \\left[ \\zeta_r \\mb{v}^r, \\zeta_s\\mb{v}^{s} \\right]_{\\mb{P}} +
 \\left[ \\zeta_r \\mb{v}^r, \\zeta_{-s}\\mb{v}^{-s} \\right]_{\\mb{P}} +
 \\left[ \\zeta_{-r} \\mb{v}^{-r}, \\zeta_s\\mb{v}^{s} \\right]_{\\mb{P}} +
 \\left[ \\zeta_{-r} \\mb{v}^{-r}, \\zeta_{-s}\\mb{v}^{-s} \\right]_{\\mb{P}}
\\right) \\\\
&=
2 \\sum_{r=1}^m \\left| \\zeta_r \\right|^2 - 2 \\sum_{r=1}^m \\left| \\zeta_{-r} \\right|^2.
\\end{align}
$$

:proposition:

  :let: $\\mb{p} = \\left(\\zeta_1, \\ldots, \\zeta_m \\right)$ and $\\mb{q} =
  \\left(\\zeta_{-1}, \\ldots, \\zeta_{-m} \\right)$ for a given vector $\\mb{z}$. ::
  :claim: $\\mb{z}$ is $\\mb{P}$-neutral if and only if there exists a unitary
  matrix $\\mb{R}$ such that $\\mb{p} = \\mb{R q}$. ::

::

:proof:

  :step: $\\Longleftarrow$

    :p:

      :step: :let: $\\mb{R} \\in \\mathbb{C}^{m \\times m}$ be a unitary matrix such
      that $\\mb{p} = \\mb{R q}$. :: ::

      :step:

	:claim: $\\sum_{r=1}^m \\left| \\zeta_r \\right|^2 = \\sum_{r=1}^m \\left| \\zeta_{-r} \\right|^2$. ::

	:p: We have
	    $$
	    \\sum_{r=1}^m \\left| \\zeta_r \\right|^2
            =
            \\mb{p}^* \\mb{p}
            =
            \\left(\\mb{R q}\\right)^* \\left(\\mb{R q}\\right)
            =
            \\mb{q}^* \\mb{q}
            =
            \\sum_{r=1}^m \\left| \\zeta_{-r} \\right|^2.
	    $$

	:: ::

      :step: $\\,$ :qed:

        :p: From :prev: and :ref:eqn-product-basis::. ::

      ::

    :: ::

  :step: $\\Longrightarrow$

    :p:

      :step: :assume: $\\mb{z}$ is neutral, that is, that $\\mb{p}^* \\mb{p} =
      \\mb{q}^* \\mb{q}$::. ::

      :step: :qed:

	:p:

	  There are in fact infinitely many unitary matrices $\\mb{R}$ in this case
	  since there are infinitely many linear maps that take $\\mb{p}$ to
	  $\\mb{q}$ while rotating or reflecting the rest of the space.:: ::

    :: ::

::

:corollary:

  :let: $\\mb{R}$ be an $m \\times m$ unitary matrix.  The subspace $\\left\\{\\mb{z}
  \\colon \\mb{p} = \\mb{R} \\mb{q} \\right\\}$ is neutral. ::

::

We have shown that the set of all neutral vectors (the neutral? cone) is the union of
the spaces $\\left\\{ \\mb{z} \\colon \\mb{p} = \\mb{R} \\mb{q} \\right\\}$.
This family of spaces is parameterized by the set of $m \\times m$ unitary matrices
$\\mb{R}$.  This is not only a set but the Lie group $U(n)$, thus a group that is
also a differentiable manifold.  In other words, /we have a vector bundle over $U(n)$/.

It is known that the tangent bundle of a Lie group is trivial.  But can we give our cone
some other interesting topology that makes it a non-trivial vector bundle?  And if so,
how can we use this?

Another observation is that the spaces $\\left\\{ \\mb{z} \\colon \\mb{p} =
\\mb{R} \\mb{q} \\right\\}$ have non-trivial intersections (related to the
eigenvectors of eigenvalue $1$ of certain unitary matrices).  These intersections may be
the key to figuring out a natural topology for this space.


:draft: if this is a hyperbola, what are the foci? where are the cosh and sinh? ::

:draft: From the same equation above it is also easy to construct (maximal) positive and
negative subspaces, and combining those with neutral subspaces we can build non-negative
and non-positive subspaces.  But what about building all?::

:draft: The invariant subspace corresponding to $\\lambda = 1$ of a NBM is clearly a
positive subspace. What about $\\lambda = -1$? What about other unitary evals? ::


## Orthogonalization and Orthogonal Polynomials
:label: sec-orthogonal-polynomials

The canonical basis does not have a regular orthogonalization since the Gram matrix is
equal to $\\mb{P}$ and thus at least the first $m$ principal submatrices have
determinant equal to zero.

:draft: Look for orthogonalizations of paticularly interesting bases. ::



## Classes of Linear Transformations
:label: sec-linear-transformations


### Adjoint Matrices
:label: sec-adjoint-matrices

One of the most important facts is that $\\mb{B}$ is $\\mb{P}$-selfadjoint.  This
is proved directly from the definitions.

:draft:After Proposition 4.1.3 of :cite:thebook::, exhibit the matrices involved in using the
flip and the sip.  What is the transformation that when applied to $\\mb{B}$ results
in a sip-selfadjoint matrix?::

Following :ref:prop-flip:: we can write
$$
\\mb{P} =
\\frac{1}{2}
\\left(
\\begin{array}
\\,\\mb{I} & \\phantom{-}\\mb{I} \\\\
\\mb{I} & \\mb{-I}
\\end{array}
\\right)
\\left(
\\begin{array}
\\,\\mb{I} & \\phantom{-}\\mb{0} \\\\
\\mb{0} & \\mb{-I}
\\end{array}
\\right)
\\left(
\\begin{array}
\\,\\mb{I} & \\phantom{-}\\mb{I} \\\\
\\mb{I} & \\mb{-I}
\\end{array}
\\right).
$$

Similarly, for the sip matrix $\\mb{S}_{2m}$, we have
$$
\\mb{S}_{2m}
=
\\frac{1}{2}
\\left(
\\begin{array}
\\,\\mb{I} & \\mb{S}_{m} \\\\
\\mb{S}_{m} & -\\mb{I}
\\end{array}
\\right)
\\left(
\\begin{array}
\\,\\mb{I} & \\mb{0} \\\\
\\mb{0} & -\\mb{I}
\\end{array}
\\right)
\\left(
\\begin{array}
\\,\\mb{I} & \\mb{S}_{m} \\\\
\\mb{S}_{m} & -\\mb{I}
\\end{array}
\\right)
.
$$
Therefore,
$$
\\begin{align}
\\left(
\\begin{array}
\\,\\mb{I} & \\mb{S}_{m} \\\\
\\mb{S}_{m} & -\\mb{I}
\\end{array}
\\right)
\\mb{S}_{2m}
\\left(
\\begin{array}
\\,\\mb{I} & \\mb{S}_{m} \\\\
\\mb{S}_{m} & -\\mb{I}
\\end{array}
\\right)
&=
\\left(
\\begin{array}
\\,\\mb{I} & \\phantom{-}\\mb{I} \\\\
\\mb{I} & \\mb{-I}
\\end{array}
\\right)
\\mb{P}
\\left(
\\begin{array}
\\,\\mb{I} & \\phantom{-}\\mb{I} \\\\
\\mb{I} & \\mb{-I}
\\end{array}
\\right)

\\\\
4 \\mb{S}_{2m}
&=
\\left(
\\begin{array}
\\,\\mb{I} & \\mb{S}_{m} \\\\
\\mb{S}_{m} & -\\mb{I}
\\end{array}
\\right)
\\left(
\\begin{array}
\\,\\mb{I} & \\phantom{-}\\mb{I} \\\\
\\mb{I} & \\mb{-I}
\\end{array}
\\right)
\\mb{P}
\\left(
\\begin{array}
\\,\\mb{I} & \\phantom{-}\\mb{I} \\\\
\\mb{I} & \\mb{-I}
\\end{array}
\\right)
\\left(
\\begin{array}
\\,\\mb{I} & \\mb{S}_{m} \\\\
\\mb{S}_{m} & -\\mb{I}
\\end{array}
\\right) \\\\
4 \\mb{S}_{2m}
&=
\\left(
\\begin{array}
\\,\\mb{S}_m + \\mb{I} & \\mb{I}-\\mb{S}_m \\\\
\\mb{S}_m - \\mb{I} & \\mb{I} + \\mb{S}_m
\\end{array}
\\right)
\\mb{P}
\\left(
\\begin{array}
\\,\\mb{I} + \\mb{S}_m & \\mb{S}_m - \\mb{I} \\\\
\\mb{I} - \\mb{S}_m & \\mb{S}_m + \\mb{I}
\\end{array}
\\right) \\\\
\\mb{S}_{2m}
&=
\\mb{Q}\\mb{P}\\mb{Q}^{*},
\\end{align}
$$
for $\\mb{Q} = \\frac{1}{2} \\left(\\begin{array}
\\,\\mb{S}_m + \\mb{I} & \\mb{I} - \\mb{S}_m \\\\
\\mb{S}_m - \\mb{I} & \\mb{I} + \\mb{S}_m
\\end{array}\\right)$.  This in turn implies that
$$
\\mb{B}'' := \\left( \\mb{Q}^* \\right)^{-1} \\mb{B} \\mb{Q}^*
$$
is $\\mb{S}_{2m}$-selfadjoint.

We have that $\\mb{Q}^{2} = \\mb{S}_{2m}$.  Therefore,
$\\mb{Q}^{-1} = \\mb{S}_{2m}\\mb{Q}$.  Now we can write
$$
\\mb{B}''
=
\\mb{Q}^{*} \\mb{S}_{2m} \\mb{B} \\mb{Q}^{*}.
$$

:draft: are $\\mb{P}$ or $\\mb{B}$ persymmetric or centrosymmetric?::


### H-selfadjoint Matrices\\: Examples and Simplest Properties
:label: sec-selfadjoint-matrices


### H-unitary Matrices\\: Examples and Simplest Properties
:label: sec-unitary-matrices

According to Proposition 4.3.4 of :cite:thebook::, we have that any Cayley transform of
$\\mb{B}$ will be $\\mb{P}$-unitary.  Thus, for any $\\left| \\alpha \\right| = 1$
and $w \\neq \\overline{w}$, the matrix
$$
U := \\alpha \\left( B - \\overline{w} I \\right) \\left( B - w I \\right)^{-1}
$$
is $\\mb{P}$-unitary.  Furthermore, the eigenvalues of $\\mb{U}$ are the Cayley
transform of the eigenvalues of $\\mb{B}$, and the root subspaces are kept intact
(which is in fact a special case of the more general fact that analytic transformations
preserve root subspaces and transform the eigenvalues).

$\\mb{P}$-unitary matrices have a spectrum that is symmetrical with respect to the
unit circle.

:draft: Is $\\mb{B}$ $(\\mb{P}, \\mb{S})$-unitary? See eqn 4.3.20 in the
book. ::


### A second characterization of H-unitary matrices
:label: sec-charac-unit


### Unitary similarity
:label: sec-unitary-simil


### Contractions
:label: sec-contractions


### Dissipative matrices
:label: sec-dissipative


### Symplectic matrices
:label: sec-symplectic


### Exercises
:label: sec-4-exercises

:proposition:
  :title: Exercise 8

  :let: $\\mb{A}$ be an $\\mb{H}$-orthogonal projection in
  $\\mathbb{C}^n(\\mb{H})$::.  :prove: that $\\text{Ker}(\\mb{A})$ and
  $\\text{Range}(\\mb{A})$ are $\\mb{H}$-orthogonal and $\\mb{A}^{[*]} =
  \\mb{A}$.::

::

:proof:

  :step: :let: $\\mb{x} \\in \\text{Ker}(\\mb{A})$ and $\\mb{y} \\in
  \\text{Range}(\\mb{A})$ with $\\mb{y} = \\mb{A} \\mb{z}$. :: ::

  :step: :draft: complete me :: We have
    $$
      \\begin{align}
      [\\mb{x}, \\mb{y}]_{\\mb{P}}
      =
      \\left[ \\mb{x}, \\mb{A} \\mb{z} \\right]_{\\mb{P}}
      =
      \\left[ \\mb{A}^{*} \\mb{x}, \\mb{z} \\right]_{\\mb{P}}
      =
      \\left[ \\mb{A}^{*} \\mb{x}, \\mb{z} \\right]_{\\mb{P}}
      \\end{align}
    $$
 ::



## Scratch
:label: sec-scratch

:proposition:
  :label: left-right-evectors

  :let: $\\lambda$ be nonreal :: and :let: $\\mb{v}$ be a right eigenvector of
  $\\lambda$ ::.  :let: $\\mb{u} = \\overline{\\mb{P v}}$ ::. Then

  :enumerate:

    :-: :claim: $\\overline{\\mb{v}}$ is a right eigenvector of $\\overline{\\lambda}$. ::

    :-: :claim: $\\mb{u}^*$ is a left eigenvector of $\\lambda$. ::

    :-: :claim: $\\mb{u}^\\top$ is a left eigenvector of $\\overline{\\lambda}$. ::

    :-: :claim: $\\left[\\mb{v}, \\mb{v} \\right]_\\mb{P} = 0 = \\left[\\mb{u}, \\mb{u} \\right]_\\mb{P}$. ::

    :-: :claim: $\\left[\\mb{v}, \\overline{\\mb{v}} \\right]_\\mb{P} = \\overline{\\left[\\mb{u}, \\overline{\\mb{u}} \\right]_\\mb{P}} = \\mb{u}^* \\mb{v} = \\mb{v}^\\top \\mb{P v}$. ::

  ::

::


:proof:

  :step: :claim: $\\overline{\\mb{v}}$ is a right eigenvector of $\\overline{\\lambda}$. ::

    :p: Take the complex conjugate of the equation $\\mb{B v} = \\lambda \\mb{v}$. :: ::

  :step: :claim: $\\mb{u}^*$ is a left eigenvector of $\\lambda$. ::

    :p: We have
      $$
      :label: eqn-u
      \\begin{align}
      \\mb{B} \\mb{v} &= \\lambda \\mb{v} \\\\
      \\mb{P} \\mb{B}^* \\mb{P} \\mb{v} &= \\lambda \\mb{v} \\\\
      \\mb{B}^* \\mb{P} \\mb{v} &= \\lambda \\mb{P} \\mb{v} \\\\
      \\mb{B}^* \\overline{\\mb{u}} &= \\lambda \\overline{\\mb{u}} \\\\
      \\overline{\\mb{u}}^\\top \\mb{B} &= \\lambda \\overline{\\mb{u}}^\\top,
      \\end{align}
      $$
      where in the last step we have taken the transpose and not the complex adjoint.

    :: ::

  :step: :claim: $\\mb{u}^\\top$ is a left eigenvector of $\\overline{\\lambda}$. ::

    :p: Take the complex conjugate of the last step in :ref:eqn-u::, and recall $\\overline{\\mb{B}} = \\mb{B}$. :: ::

  :step: :claim: $\\left[\\mb{v}, \\mb{v} \\right]_\\mb{P} = 0 = \\left[\\mb{u}, \\mb{u} \\right]_\\mb{P}$. ::

    :p: Due to result 4.2.5 from :cite:thebook::, which says that the root subspace
    coresponding to a nonreal eigenvalue is $\\mb{P}$-neutral. :: ::

  :step: :claim: $\\left[\\mb{v}, \\overline{\\mb{v}} \\right]_\\mb{P} = \\overline{\\left[\\mb{u}, \\overline{\\mb{u}} \\right]_\\mb{P}} = \\mb{u}^* \\mb{v} = \\mb{v}^\\top \\mb{P v}$. ::

    :p: All these equations are established by direct evaluation.  For example,
      $$
      \\begin{align}
      \\left[\\mb{u}, \\overline{\\mb{u}}\\right]_\\mb{P}
      &=
      \\mb{u}^\\top \\mb{P} \\overline{\\overline{\\mb{u}}} \\\\
      &=
      \\left(\\overline{\\mb{P v}}\\right)^\\top \\mb{P} \\left(\\overline{\\mb{P v}}\\right) \\\\
      &=
      \\mb{v}^* \\mb{P} \\mb{P} \\mb{P} \\overline{\\mb{v}} \\\\
      &=
      \\mb{v}^* \\mb{P} \\overline{\\mb{v}} \\\\
      &=
      \\overline{\\mb{v}^\\top \\mb{P} \\mb{v}} \\\\
      &=
      \\overline{\\left[\\mb{v}, \\overline{\\mb{v}}\\right]_\\mb{P}}
      \\end{align}
      $$ :: ::

::


:proposition:

  :let: $\\lambda$ be nonreal :: and :let: $\\mb{v}$ be a right eigenvector of
  $\\lambda$ such that $\\mb{v}^\\top \\mb{P} \\mb{v} = 1$ ::.  :let: $\\mb{u}
  = \\overline{\\mb{P v}}$ ::. Then $\\mb{v} \\mb{u}^*$ is the eigenprojection
  (a.k.a. principal idempotent) of $\\mb{B}$ corresponding to $\\mb{v}$.  That is
  to say,
  $$
  \\mb{B} \\left(\\mb{v} \\mb{u}^*\\right) = \\lambda \\left(\\mb{v} \\mb{u}^*\\right) = \\left(\\mb{v} \\mb{u}^*\\right) \\mb{B}
  \\quad\\text{and}\\quad
  \\left(\\mb{v} \\mb{u}^*\\right)^2 = \\mb{v} \\mb{u}^*.
  $$

::

:proof:

  :step: :claim: $\\mb{B} \\left(\\mb{v} \\mb{u}^*\\right) = \\lambda
  \\left(\\mb{v} \\mb{u}^*\\right) = \\left(\\mb{v} \\mb{u}^*\\right)
  \\mb{B}$. ::

    :p: Immediate from the fact that $\\mb{v}, \\mb{u}^*$ are right, left
    eigenvectors of $\\mb{B}$ corresponding to $\\lambda$. :: ::


  :step: :claim: $\\left(\\mb{v} \\mb{u}^*\\right)^2 = \\mb{v} \\mb{u}^*$. ::

    :p: $\\left(\\mb{v} \\mb{u}^*\\right)^2 = \\mb{v} \\mb{u}^* \\mb{v}
    \\mb{u}^* = \\left(\\mb{v}^\\top \\mb{P} \\mb{v} \\right) \\mb{v}
    \\mb{u}^* = \\mb{v} \\mb{u}^*$. :: ::

::

The preceeding result is immediate from the fact that $\\mb{u}$ is the left
eigenvector corresponding to $\\mb{v}$.  What''s important here is that we have been
able to write both $\\mb{u} = \\overline{\\mb{P v}}$ and the normalization constant
$\\mb{v}^\\top \\mb{P} \\mb{v} = 1$ purely in terms of $\\mb{v}$.

:remark:

  :draft: Taking the adjoint does not commute with taking a restriction. ::

::

:lemma:

  :let: $\\mb{B v} = \\lambda \\mb{v}$ with nonreal $\\lambda$ ::. Then, :claim:
  $\\left( \\left|\\lambda\\right|^2 - 1 \\right) \\mb{v}^* \\mb{v} =\\sum_j
  \\left|\\into{v}{j}\\right|^2 \\left( d_j - 2 \\right)$ ::.

::

:proof:

  :step: :claim: $0 = \\sum_{i \\to j} \\mb{v}_{i \\to j} \\overline{\\mb{v}}_{j \\to i}$ ::.

    :p: We have
      $$
      \\begin{align}
      0
      =
      \\left[ \\mb{v}, \\mb{v} \\right]_\\mb{P}
      =
      \\mb{v}^\\top \\mb{P} \\overline{\\mb{v}}
      =
      \\sum_{i \\to j} \\mb{v}_{i \\to j}\\left( \\mb{P} \\overline{\\mb{v}} \\right)_{i \\to j}
      =
      \\sum_{i \\to j} \\mb{v}_{i \\to j} \\overline{\\mb{v}}_{j \\to i} = \\star.
      \\end{align}
      $$ :: ::

  :step: :claim: $\\lambda^{-1} \\sum_j \\left|\\into{v}{j}\\right|^2 \\left( d_j - 1 \\right) = \\overline{\\lambda} \\mb{v}^* \\mb{v}$ ::.

    :p:

      :step: Applying :draft: such and such :: in $\\star$, we have
        $$
        \\begin{align}
        \\star
        &=
        \\sum_{i \\to j} \\overline{\\mb{v}}_{j \\to i} \\left( \\into{v}{j} - \\lambda \\mb{v}_{j \\to i} \\right) \\\\
        &=
        \\sum_j \\into{v}{j} \\sum_i a_{ij} \\overline{\\mb{v}}_{j \\to i} - \\lambda \\sum_{i \\to j} \\overline{\\mb{v}}_{j \\to i} \\mb{v}_{j \\to i} \\\\
        &=
        \\sum_j \\into{v}{j} \\overline{\\from{v}{j}} - \\lambda \\mb{v}^* \\mb{v} \\\\
        &=
        \\star \\star.
        \\end{align}
        $$

	Now take the conjugate and observe $\\mb{v}^* \\mb{v} \\in \\mathbb{R}$.
  	$$
  	\\begin{align}
        \\star \\star
        &=
        \\sum_j \\overline{\\into{v}{j}} \\from{v}{j} - \\overline{\\lambda} \\mb{v}^* \\mb{v}
        =
        \\sum_j \\overline{\\into{v}{j}} \\lambda^{-1} \\left( d_j - 1 \\right) \\into{v}{j} - \\overline{\\lambda} \\mb{v}^* \\mb{v}.
        \\end{align}
        $$ :: :: ::

  :step: :claim: $\\sum_i \\left|\\into{v}{i}\\right|^2 = \\mb{v}^* \\mb{v}$ ::.

    :p: We have
      $$
      \\begin{align}
      \\star
      &=
      \\sum_{i \\to j} \\overline{\\mb{v}}_{j \\to i} \\lambda^{-1} \\left( \\into{v}{i} - \\mb{v}_{j \\to i} \\right)
      =
      \\lambda^{-1} \\sum_i \\into{v}{i} \\sum_j a_{ij} \\overline{\\mb{v}}_{j \\to i}  - \\lambda^{-1} \\sum_{i \\to j} \\overline{\\mb{v}}_{j \\to i} \\mb{v}_{j \\to i} \\\\
      &=
      \\lambda^{-1} \\sum_i \\into{v}{i} \\overline{\\into{v}{i}} - \\lambda^{-1} \\mb{v}^* \\mb{v}.
      \\end{align}
      $$ :: ::


  :step: :qed:

    Multiplying :prev2: by $\\lambda$ and subtracting :prev:.

  ::

::

:proposition:

  :let: $\\mb{B} \\mb{v} = \\lambda \\mb{v}$ with $\\left|\\lambda\\right| = 1$ ::.
  Then :claim: $\\into{v}{j} \\left( d_j - 2 \\right) = 0$, for each node $j$::.

::

:proof:

  :step:

    Direct from previous lemma, noting that each term in the sum is non-negative, and
    that $\\left|\\into{v}{j}\\right| = 0 \\iff \\into{v}{j} = 0$.

  ::

::

:proposition:

  :let: $\\lambda$ be a nonreal eigenvalue::.  Then, :claim: $\\left|\\lambda\\right|^2 \\geq
  1$ ::.

::

:proof:

  Direct from the lemma.  :draft: this is nice, but is it necessary? ::

::

:proposition:

  :let: $\\mb{B v} = \\lambda \\mb{v}$ with nonreal $\\lambda$::. Then, :claim:
  $\\mb{B}^* \\mb{B} \\mb{v} = \\mb{B} \\mb{B}^* \\mb{v} = \\mb{v}$
  ::.

::

:proof:

  Also from the lemma.

::

:proposition:

  :let: $\\mb{B v} = \\lambda \\mb{v}$ with nonreal $\\lambda$ ::. :claim: $\\sum_j
  \\left|\\into{v}{j} \\right|^2 = \\mb{v}^* \\mb{v}$ ::.

::

:proof:

  This is exactly the second to last step in the lemma.

::



## Diagonalizability
:label: sec-diagonaliza

:draft: See exercise 10 of section 5 of the book (page 122) ::

:let: $G$ be a graph with NBM $\\mb{B}$::. :assume: $\\mb{B}$ is diagonalizable ::
and :let: $\\mb{R}$ be a full-rank matrix of eigenvectors, and $\\mb{\\Lambda}$ the
corresponding diagonal matrix of eigenvalues::.  We have
$$
\\mb{B} \\mb{R} = \\mb{R} \\mb{\\Lambda}.
$$

:write: $\\mb{L} := \\mb{R}^{-1}$ ::.  Observe that $\\mb{L}$ is a
matrix of left eigenvectors of $\\mb{B}$,
$$
\\begin{align}
\\mb{B} \\mb{R}
&=
\\mb{R} \\mb{\\Lambda} \\\\
\\mb{B}
&=
\\mb{R} \\mb{\\Lambda} \\mb{L} \\\\
\\mb{L} \\mb{B}
&=
\\mb{\\Lambda} \\mb{L}.
\\end{align}
$$

On the other hand, by :ref:left-right-evectors::, we know that $\\left(
\\overline{\\mb{P} \\mb{R}} \\right)^* = \\mb{R}^\\top \\mb{P}$ is also a
matrix of left eigenvectors.  The natural question is to ask whether this is the same as
$\\mb{L}$, or in other words, whether
$$
\\mb{R}^{-1} \\stackrel{?}{=} \\mb{R}^\\top \\mb{P}
\\quad\\text{or, equivalently,}\\quad
\\mb{I} \\stackrel{?}{=} \\mb{R}^\\top \\mb{P} \\mb{R}.
$$

We will see that this is not in general the case, though there is a decomposition of
$\\mb{R}$ that is almost as good.

:let: $\\lambda, \\mu$ be two distinct real eigenvalues of $\\mb{B}$ ::.  By Theorem
4.2.4 of :cite:thebook::, we have that $\\left[ \\mb{v}, \\mb{u} \\right]_\\mb{P}
= 0$, for any eigenvector $\\mb{v}$ of $\\lambda$ and any eigenvector $\\mb{u}$ of
$\\mu$.  Furthermore, in this case we have
$$
0
=
\\left[ \\mb{v}, \\mb{u} \\right]_\\mb{P}
=
\\mb{v}^\\top \\mb{P} \\overline{\\mb{u}}
=
\\mb{v}^\\top \\mb{P} \\mb{u},
$$
since $\\mb{u}$ can always be chosen with real components.  Furthermore, $\\mb{v}$
can be chosen to satisfy $\\mb{v}^\\top \\mb{P} \\mb{v} = 1$.  This is because
$\\left[ \\mb{v}, \\mb{v} \\right]_\\mb{P}$ is non-zero if and only if $\\lambda$
is non-defective.

:draft: MISSING\\: what if $\\lambda$ has two orthogonal eigenvectors?::

Now :assume: $\\lambda, \\mu$ are two distinct nonreal eigenvalues of $\\mb{B}$ ::.  We
are interested in the form
$$
\\mb{v}^\\top \\mb{P} \\mb{u} = \\left[ \\mb{v}, \\overline{\\mb{u}} \\right]_\\mb{P}.
$$

Note that $\\overline{\\mb{u}}$ is an eigenvector of $\\overline{\\mu}$.  Applying
Theorem 4.2.4 of :cite:thebook:: to $\\lambda$ and $\\overline{\\mu}$, we have that $\\left[
\\mb{v}, \\overline{\\mb{u}} \\right]_\\mb{P} = 0$ whenever $\\lambda \\neq \\mu$.
Furthermore, like in the real case, we have that $\\mb{v}^\\top \\mb{P} \\mb{v}
= \\left[ \\mb{v}, \\overline{\\mb{v}} \\right] = 1$ because $\\lambda$ is
non-defective.

:draft: MISSING\\: what if $\\lambda$ has two orthogonal eigenvectors?::

When $\\lambda$ is real and $\\mu$ is not, we immediately have $\\mb{v}^\\top \\mb{P}
\\mb{u} = \\left[ \\mb{v}, \\overline{\\mb{u}} \\right]_\\mb{P} = 0$.

:draft: did we just prove what we said we couldn''t prove??? ::

With this observation, if $\\left\\{ \\mb{v} \\right\\}_{r=1}^m$ is a full basis of right
eigenvectors, we can now write
$$
\\mb{B}
=
\\mb{R} \\mb{\\Lambda} \\mb{L}
=
\\sum_r \\lambda_r \\frac{\\mb{v}_r \\mb{v}_r^\\top \\mb{P}}{\\mb{v}_r^\\top \\mb{P} \\mb{v}_r}.
$$

This is particularly important for matrix functions of $\\mb{B}$.  If $f$ is analytic
in a neighborhood of each of the eigenvalues of $\\mb{B}$, we have
$$
f\\left( \\mb{B} \\right)
=
\\sum_r f\\left( \\lambda_r \\right) \\frac{\\mb{v}_r \\mb{v}_r^\\top \\mb{P}}{\\mb{v}_r^\\top \\mb{P} \\mb{v}_r}.
$$

As a particular example, we have the resolvent of $\\mb{B}$,
$$
\\left( \\mb{B} - t \\mb{I} \\right)^{-1}
=
\\sum_r \\left( \\lambda_r - t \\right)^{-1} \\frac{\\mb{v}_r \\mb{v}_r^\\top \\mb{P}}{\\mb{v}_r^\\top \\mb{P} \\mb{v}_r}.
$$



:bibliography: ::

::



:bibtex:

@book{thebook,
  title={Indefinite Linear Algebra and Applications},
  author={Israel Gohberg, Peter Lancaster, Leiba Rodman},
  year={2005},
  publisher={Birkhäuser Basel},
  doi={https://doi.org/10.1007/b137517},
}

::
', NULL, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO files (id, title, abstract, keywords, status, last_edited_at, created_at, doi, source, deleted_at, owner_id) VALUES (11, 'The canonical basis is not P-normal', '', NULL, 'DRAFT', '2025-06-11 19:43:50.691555+00', '2025-06-03 21:02:07.31022+00', NULL, E':rsm:

# The canonical basis is not P-normal

:paragraph: {:types: hide} preamble
$$
  :nonum:
\\newcommand{\\into}[2]{{\\vec{\\mathbf{#1}}}^{{#2}}}
\\newcommand{\\from}[2]{{{}}^{{#2}}{\\vec{\\mathbf{#1}}}}
\\newcommand{\\mb}[1]{\\mathbf{#1}}
$$

The canonical basis of $\\mathbb{C}^{2m}$ is not $\\mb{P}$-orthonormal.
$$ \\left[ \\mb{v}^i, \\mb{v}^i \\right]_\\mb{P} =
\\sum_{r=1}^{2m} \\mb{v}^i_r \\overline{\\mb{v}^i_{m+r}} = \\mb{v}_i^i
\\mb{v}_{m+i}^i + \\mb{v}_{m+i}^i \\mb{v}_{i}^i = \\begin{cases} - 2, & i \\in
\\left\\{ -m, \\ldots, -1 \\right\\} \\\\ \\phantom{-} 2, & i \\in \\left\\{ 1, \\ldots, m
\\right\\}. \\\\ \\end{cases}
 $$

Additionally,
$$
\\begin{align}
\\left[\\mb{v}^i, \\mb{v}^j\\right]_\\mb{P}
&=
0,
\\text{ for each } i \\in \\{-m, \\ldots, -1, 1, \\ldots, m\\} \\text{ and each } j \\neq -i, \\\\
\\left[\\mb{v}^i, \\mb{v}^{-i} \\right]_\\mb{P}
&=
\\sum_{r=1}^{2m} \\mb{v}^i_r \\overline{\\mb{v}^{-i}_{m+r}}
=
\\mb{v}_i^i \\mb{v}_{m+i}^{-i} + \\mb{v}_{m+i}^i \\mb{v}_{i}^{-i}
= -1 + 1 = 0.
\\end{align}
$$
Therefore, the set $\\left\\{ \\frac{\\mb{v}^i}{\\sqrt{2}} \\colon i = -m,
\\ldots, -1, 1, \\ldots, m \\right\\}$ is a $\\mb{P}$-orthonormal basis.

Still, we have the following computation,
$$
\\begin{align}
\\left(\\mb{v}^i\\right)^* \\mb{v}^i
&=
\\sum_{r=1}^{2m} \\overline{\\mb{v}^i_r} \\mb{v}^i_{r}
=
\\overline{\\mb{v}^i_i} \\mb{v}^i_i + \\overline{\\mb{v}^i_{m+i}} \\mb{v}^i_{m+i} \\\\
&=
1 + 1
=
2,
\\text{ for each } i \\in \\{1, \\ldots, m\\}
\\end{align}
$$

::
', NULL, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO files (id, title, abstract, keywords, status, last_edited_at, created_at, doi, source, deleted_at, owner_id) VALUES (12, 'New File', '', NULL, 'DRAFT', '2025-06-08 09:30:46.326197+00', '2025-06-07 18:49:13.494981+00', NULL, ':rsm:
# New File

The possibilities are *endless*!

::
', '2025-06-08 09:30:46.496825+00', 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO files (id, title, abstract, keywords, status, last_edited_at, created_at, doi, source, deleted_at, owner_id) VALUES (145, '', '', NULL, 'DRAFT', '2025-06-24 09:14:42.903235+00', '2025-06-24 09:14:37.274994+00', NULL, ':rsm:
# New File

The possibilities are *endless*!

::
', '2025-06-24 09:14:42.905986+00', 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO files (id, title, abstract, keywords, status, last_edited_at, created_at, doi, source, deleted_at, owner_id) VALUES (156, '', '', NULL, 'DRAFT', '2025-06-24 09:53:11.632036+00', '2025-06-24 09:22:56.90889+00', NULL, ':rsm:
# New File

The possibilities are *endless*!

::
', '2025-06-24 09:53:11.637516+00', 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO files (id, title, abstract, keywords, status, last_edited_at, created_at, doi, source, deleted_at, owner_id) VALUES (157, '', '', NULL, 'DRAFT', '2025-06-24 09:53:06.169976+00', '2025-06-24 09:27:45.996702+00', NULL, ':rsm:
# New File

The possibilities are *endless*!

::
', '2025-06-24 09:53:06.173984+00', 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO files (id, title, abstract, keywords, status, last_edited_at, created_at, doi, source, deleted_at, owner_id) VALUES (179, 'New File', '', NULL, 'DRAFT', '2025-06-26 20:40:24.710274+00', '2025-06-24 14:47:05.626705+00', NULL, ':rsm:
# New File

The possibilities are *endless*!

::
', '2025-06-26 20:40:24.720753+00', 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO files (id, title, abstract, keywords, status, last_edited_at, created_at, doi, source, deleted_at, owner_id) VALUES (205, 'New handrails are cool (Copy)', '', NULL, 'DRAFT', '2025-06-24 15:43:10.301487+00', '2025-06-24 15:43:10.301487+00', NULL, ':rsm:
# New handrails are cool

## Icons
  :label: sec-one
  :icon: heart

:paragraph: {:icon: star} Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed
do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,
quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

:theorem:
  :icon: question

  This is the statement of the theorem, and it contains math!
  $$
  2+2=4.
  $$
  This is the same paragraph.

  :paragraph: {:icon: alert} And here is another one paragraph that does not have math
  within it.

  And another $2+2=4$.

::
', NULL, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO files (id, title, abstract, keywords, status, last_edited_at, created_at, doi, source, deleted_at, owner_id) VALUES (791, 'New File', '', NULL, 'DRAFT', '2025-06-26 20:40:28.865443+00', '2025-06-26 20:40:28.865443+00', NULL, ':rsm:
# New File

The possibilities are *endless*!

::
', NULL, 4) ON CONFLICT (id) DO NOTHING;

-- Insert all file-tag relationships
INSERT INTO file_tags (file_id, tag_id) VALUES (1, 15) ON CONFLICT (file_id, tag_id) DO NOTHING;
INSERT INTO file_tags (file_id, tag_id) VALUES (2, 15) ON CONFLICT (file_id, tag_id) DO NOTHING;
INSERT INTO file_tags (file_id, tag_id) VALUES (3, 15) ON CONFLICT (file_id, tag_id) DO NOTHING;
INSERT INTO file_tags (file_id, tag_id) VALUES (4, 14) ON CONFLICT (file_id, tag_id) DO NOTHING;
INSERT INTO file_tags (file_id, tag_id) VALUES (5, 14) ON CONFLICT (file_id, tag_id) DO NOTHING;
INSERT INTO file_tags (file_id, tag_id) VALUES (6, 15) ON CONFLICT (file_id, tag_id) DO NOTHING;
INSERT INTO file_tags (file_id, tag_id) VALUES (7, 15) ON CONFLICT (file_id, tag_id) DO NOTHING;
INSERT INTO file_tags (file_id, tag_id) VALUES (7, 21) ON CONFLICT (file_id, tag_id) DO NOTHING;
INSERT INTO file_tags (file_id, tag_id) VALUES (8, 14) ON CONFLICT (file_id, tag_id) DO NOTHING;
INSERT INTO file_tags (file_id, tag_id) VALUES (8, 25) ON CONFLICT (file_id, tag_id) DO NOTHING;
INSERT INTO file_tags (file_id, tag_id) VALUES (9, 22) ON CONFLICT (file_id, tag_id) DO NOTHING;
INSERT INTO file_tags (file_id, tag_id) VALUES (9, 27) ON CONFLICT (file_id, tag_id) DO NOTHING;
INSERT INTO file_tags (file_id, tag_id) VALUES (10, 10) ON CONFLICT (file_id, tag_id) DO NOTHING;
INSERT INTO file_tags (file_id, tag_id) VALUES (10, 11) ON CONFLICT (file_id, tag_id) DO NOTHING;
INSERT INTO file_tags (file_id, tag_id) VALUES (10, 13) ON CONFLICT (file_id, tag_id) DO NOTHING;
INSERT INTO file_tags (file_id, tag_id) VALUES (10, 16) ON CONFLICT (file_id, tag_id) DO NOTHING;
INSERT INTO file_tags (file_id, tag_id) VALUES (10, 19) ON CONFLICT (file_id, tag_id) DO NOTHING;
INSERT INTO file_tags (file_id, tag_id) VALUES (10, 26) ON CONFLICT (file_id, tag_id) DO NOTHING;
INSERT INTO file_tags (file_id, tag_id) VALUES (11, 14) ON CONFLICT (file_id, tag_id) DO NOTHING;
INSERT INTO file_tags (file_id, tag_id) VALUES (11, 15) ON CONFLICT (file_id, tag_id) DO NOTHING;
INSERT INTO file_tags (file_id, tag_id) VALUES (11, 16) ON CONFLICT (file_id, tag_id) DO NOTHING;
INSERT INTO file_tags (file_id, tag_id) VALUES (11, 17) ON CONFLICT (file_id, tag_id) DO NOTHING;
INSERT INTO file_tags (file_id, tag_id) VALUES (11, 18) ON CONFLICT (file_id, tag_id) DO NOTHING;
INSERT INTO file_tags (file_id, tag_id) VALUES (11, 19) ON CONFLICT (file_id, tag_id) DO NOTHING;
INSERT INTO file_tags (file_id, tag_id) VALUES (11, 20) ON CONFLICT (file_id, tag_id) DO NOTHING;
INSERT INTO file_tags (file_id, tag_id) VALUES (11, 25) ON CONFLICT (file_id, tag_id) DO NOTHING;

-- Update sequences to avoid conflicts
SELECT setval('users_id_seq', GREATEST((SELECT MAX(id) FROM users), 4));
SELECT setval('tags_id_seq', GREATEST((SELECT MAX(id) FROM tags), 30));
SELECT setval('files_id_seq', GREATEST((SELECT MAX(id) FROM files), 20));
SELECT setval('profile_pictures_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM profile_pictures), 1));
