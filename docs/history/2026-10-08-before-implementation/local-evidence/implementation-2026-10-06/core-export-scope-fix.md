# Core 3.0.1 export bank ownership

Released Core3.0.0 native recursive render glob included nested standalone
Quarto projects. Native reproduction exported `exr-outsider` from nested
project into chosen bank work (implicit import), and unrelated nested duplicate
exr-local blocked bank export. Evidence: core-export-scope-audit.log.

Patch branch fix/export-bank-ownership-20261007 uses public native inspect
source inventory from full JSON context, resolves physical input containment
before document ownership inspections, then obtains native project.dir once
per physical input directory (root directory reuses existing native inventory).
Only owned lexical source paths enter the explicit Quarto render list.
Nested sources and aliases remain outside bank; physically escaping sources
fail EXPORT.SOURCE_OUTSIDE_BANK. Own unpublished QMD remains eligible; aliases
obey native input rules without invented hidden-file support. No custom YAML
or glob project resolver or extra render introduced.

RED core-bank-ownership-red.log confirmed duplicate foreign ID failure.
GREEN current core-bank-ownership-physical2.log: 3 native source passes plus
early physical escape rejection, 20.87s; stable1.10.18 ownership same suite
PASS21.12s, core-bank-ownership-stable.log. Full current npm test PASS,
/tmp/course-native-check-20261007-022547, core-full-suite-patch1.log, ~5.5min.
Includes both root/export privacy and native generated assets/PDF as well as
Presentation/Navigation browser tests. Runtime unchanged during final suite.

Descriptors all3 bundle modules version3.0.1, README/demo dependency pins3.0.1,
source/build provenance and source URLs target demo-20261007-patch1. Published
Core3.0.0/demo immutable artifacts untouched. Local commit for parent PR/CI;
no push/merge/release by implementation agent.
