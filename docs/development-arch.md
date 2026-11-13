# Рабочая среда Arch Linux

Этот документ — общее руководство для разработки Core и связанных репозиториев
курса. Пакеты среды устанавливаются в систему обычными средствами Arch;
зависимости конкретного проекта остаются в его `package.json` и `package-lock.json`.
Команды ниже сверены с владельцами реально установленных CLI и метаданными
репозиториев Arch/AUR 13 ноября 2026 года. Они выбирают текущие пакеты, поэтому
после обновления проверяйте действующие ограничения проекта и фактические версии.
Имена в командах `yay -S` проверены по отдельности через `yay -Si`.

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

Для существующей Bash-сессии приложения задайте JDK и пользовательские CLI:

```bash
export JAVA_HOME=/usr/lib/jvm/java-25-openjdk
export PATH="$JAVA_HOME/bin:$HOME/.local/bin:$PATH"
```

Для Fish:

```fish
set -gx JAVA_HOME /usr/lib/jvm/java-25-openjdk
set -gx PATH $JAVA_HOME/bin $HOME/.local/bin $PATH
```

Эти команды выбирают Java 25 для текущей сессии, включая Groovy CLI. Системный
выбор JDK сохраняется. Уже запущенное приложение не обновляет свой PATH после
установки инструментов автоматически. Пользовательские CLI из `~/.local/bin`
работают без подключения каталогов QA или workspace.

Дополнительные инструменты устанавливаются по используемым направлениям:

```bash
yay -S --needed \
  ansible-lint hadolint docker docker-compose clang ktlint maven \
  dotnet-sdk-10.0 dotnet-runtime-10.0 dotnet-host \
  bandit luacheck lychee cppcheck opentofu tflint sqlfluff \
  php powershell-bin python-pipx
```

`clang` содержит `clang-tidy`, `opentofu` — `tofu`, `powershell-bin` — `pwsh`.
Наличие Docker CLI и Compose само по себе не запускает демон и контейнеры.
Не все дополнительные инструменты нужны каждому репозиторию. Maven используется
для служебных Java-проверок Platform.

Для анализа PowerShell штатно установите PSScriptAnalyzer в профиль текущего
пользователя и проверьте импорт модуля:

```bash
pwsh -NoProfile -Command 'Install-Module -Name PSScriptAnalyzer -Scope CurrentUser -Repository PSGallery -Force -AcceptLicense'
pwsh -NoProfile -Command 'Import-Module PSScriptAnalyzer; Get-Module PSScriptAnalyzer'
```

Это стандартный каталог модулей PowerShell; отдельный `PSModulePath` не требуется.

В каждом checkout со штатным `package.json` выполните:

```bash
npm ci --ignore-scripts
npm run check-quality
npm run test:types:all
npm run check:static
```

Набор npm-команд зависит от репозитория; используйте его README и `npm run`.
Core устанавливает Prettier, Stylelint, HTML Validate, TypeScript, typed ESLint
и Pyright собственными devDependencies. В `npm run` локальные `node_modules/.bin`
имеют приоритет; глобальный Pyright не заменяет закреплённую версию проекта/CI.
Для браузерных тестов установите браузер штатной командой проекта
(`npx playwright install chromium` в Core).

Курсам, чьи проверки вызывают CLI напрямую без локального npm-проекта, нужна
обычная пользовательская установка:

```bash
npm install --global --prefix "$HOME/.local" npm-groovy-lint stylelint stylelint-scss postcss-scss html-validate
```

Команды размещаются в `~/.local/bin`, пакеты — в `~/.local/lib/node_modules`.
SCSS-плагины устанавливаются тем же штатным npm. Проектные npm-скрипты сохраняют
свои локальные зависимости; общая изменяемая копия `node_modules` между
репозиториями и правки исходников плагинов не требуются.

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
PMD обязателен для служебного Java-профиля репозитория Java. Полный банк учебных
решений остаётся отдельным аудитом: у PMD 7.29.0 сохраняется несовместимость
парсера с частью поддерживаемого синтаксиса Java 25. SpotBugs анализирует
скомпилированные классы; состав проверки задаёт профиль проекта.

Для новой пользовательской установки скачайте бинарные дистрибутивы с официальных
страниц [PMD](https://github.com/pmd/pmd/releases) и
[SpotBugs](https://github.com/spotbugs/spotbugs/releases), проверьте опубликованные
подписи или digest и распакуйте архивы вне курсов в `~/.local/share`.
Проверенное размещение текущих дистрибутивов — `~/.local/share/pmd-bin-7.29.0` и
`~/.local/share/spotbugs-4.10.5`. После распаковки свяжите их штатные entry points:

```bash
mkdir -p "$HOME/.local/bin"
ln -s "$HOME/.local/share/pmd-bin-7.29.0/bin/pmd" "$HOME/.local/bin/pmd"
ln -s "$HOME/.local/share/spotbugs-4.10.5/bin/spotbugs" "$HOME/.local/bin/spotbugs"
pmd --version
spotbugs -version
```

Старый AUR PMD не заменяет проверенный дистрибутив. Maven нужен по используемым
служебным Java-проверкам Platform: доступен пакет `maven` из команды выше или
официальный бинарный архив [Apache Maven](https://maven.apache.org/download.cgi).
Проверенная пользовательская установка Maven также находится вне курсов,
в `~/.local/share/apache-maven-3.10.0`, со ссылкой на `bin/mvn` в `~/.local/bin`.
Уже подготовленные пользовательские дистрибутивы и npm CLI сохраняются при
удалении каталогов QA.

При стабилизации состава можно создать отдельный Arch metapackage с обычным
`depends`, поддерживаемый вне репозиториев курсов. Сейчас источником настройки
служат эти команды и стандартные зависимости проектов; собственного установщика,
install hooks или второй таблицы закреплённых версий нет.
