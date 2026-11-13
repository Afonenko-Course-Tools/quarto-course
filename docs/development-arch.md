# Рабочая среда Arch Linux

Этот документ — общее руководство для разработки Core и связанных репозиториев
курса. Пакеты среды устанавливаются в систему обычными средствами Arch;
зависимости конкретного проекта остаются в его `package.json` и `package-lock.json`.
Команды ниже сверены с владельцами реально установленных CLI и метаданными
репозиториев Arch/AUR 13 ноября 2026 года. Они выбирают текущие пакеты, поэтому
после обновления проверяйте действующие ограничения проекта и фактические версии.

Для общей среды разработки с уже настроенным `yay`:

```bash
yay -S --needed \
  git bash python fish quarto-cli-bin-pre-release deno nodejs npm go-task jdk25-openjdk \
  google-java-format ruff pyright panache actionlint yamllint shellcheck shfmt \
  stylua lua-language-server taplo-cli libxml2 jq prettier bibtex-tidy
```

`quarto-cli-bin-pre-release` — имя пакета установленного Quarto; `quarto` — CLI.
Поддерживаемые версии Quarto задаёт договор конкретного проекта, а команда выше
может установить более новую версию. `go-task` предоставляет команду `go-task`;
имя `task` не предполагается. `taplo-cli` предоставляет `taplo`, `libxml2` —
`xmllint`. Для Java нужен JDK 25 с настоящими `java` и `javac`; проверьте выбор
через `archlinux-java status`, `java -version` и `javac -version`.

Дополнительные инструменты устанавливаются по используемым направлениям:

```bash
yay -S --needed \
  ansible-lint hadolint docker docker-compose clang ktlint \
  dotnet-sdk-10.0 dotnet-runtime-10.0 dotnet-host \
  bandit luacheck lychee cppcheck opentofu tflint sqlfluff \
  php powershell-bin python-pipx
```

`clang` содержит `clang-tidy`, `opentofu` — `tofu`, `powershell-bin` — `pwsh`.
Наличие Docker CLI и Compose само по себе не запускает демон и контейнеры.
Не все дополнительные инструменты нужны каждому репозиторию.

В каждом checkout со штатным `package.json` выполните:

```bash
npm ci --ignore-scripts
npm run check-quality
npm run test:types:all
npm run check:static
```

Набор npm-команд зависит от репозитория; используйте его README и `npm run`.
Core устанавливает Prettier, Stylelint, HTML Validate, TypeScript и typed ESLint
собственными devDependencies. Глобальный `prettier` удобен для отдельных файлов,
но блокирующий gate использует локальные зависимости checkout. Дополнительные
глобальные npm-плагины, изменение исходников плагинов и общий изменяемый
`node_modules` между репозиториями не нужны. Для браузерных тестов установите
браузер штатной командой проекта (`npx playwright install chromium` в Core).

Checkstyle поставляется отдельным локально собранным пакетом `checkstyle-bin`.
Храните его PKGBUILD, сборочный каталог и готовый пакет вне каталогов курсов.
Для подготовленного актуального PKGBUILD используйте стандартную сборку:

```bash
cd /путь/вне/курсов/checkstyle-bin
makepkg -si
checkstyle --version
```

Старую AUR-рецептуру не используйте как источник актуального Checkstyle. Установка
готового пакета также возможна штатной командой `sudo pacman -U /путь/к/пакету`.
PMD и SpotBugs не входят в приведённый набор: текущий аудит использует официальные
дистрибутивы вне курсов; старый AUR PMD не заменяет проверенную версию. Их отчёты
читаются с учётом совместимости с Java 25 и намеренных учебных примеров.

При стабилизации состава можно создать отдельный Arch metapackage с обычным
`depends`, поддерживаемый вне репозиториев курсов. Сейчас источником настройки
служат эти команды и стандартные зависимости проектов; собственного установщика,
install hooks или второй таблицы закреплённых версий нет.
