# Собственные стадии Core 9.2.2

Native pre/post hooks сообщают в stderr начало и завершение либо ошибку подготовки и финализации модели, путь owner и прошедшее время. Числа inputs/outputs происходят из уже прочитанного native selection; пустой технический выбор также виден. Новых inspect, обходов, хешей и getter-вызовов для отчёта нет.

Штатный `QUARTO_PROJECT_SCRIPT_QUIET=1` Quarto подавляет новый progress и его часы. Если флаг недоступен по разрешениям, отчёт молча пропускается. Прежние API, native lifecycle, final fences, JSON transport и исходная ошибка сохраняются. Общий Performance ABI не меняется.

Адресная Source-проверка использует реальный пустой pre/post lifecycle, quiet, отказ с сохранением объекта ошибки и недоступный quiet env. Native render, exports, grading и полный курс для этой правки не повторялись. Исходники являются кандидатом; installed composition и выпуск принимаются отдельно.
