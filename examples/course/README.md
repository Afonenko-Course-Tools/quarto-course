# Native book example

Install the modules into this directory, then use ordinary Quarto commands:

```sh
quarto add ../../ --no-prompt
quarto render --profile student
quarto run _extensions/course-core/entrypoints/check.ts . student
quarto render --profile full
quarto run _extensions/course-core/entrypoints/check.ts . full
```

Adjust installed paths if Quarto creates an owner directory. The optional pre/post hooks collect the current native run; the explicit check command assembles its Course model and runs CUE after successful render. For selected-document iteration use `quarto render tasks/index.qmd --profile student` or `quarto preview` and read its DocumentResult. Quarto owns all execution and caches.
