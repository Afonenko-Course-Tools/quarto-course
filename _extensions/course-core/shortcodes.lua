-- Создаётся только маркер: отбор по профилю предшествует ссылкам и архивам.
return {
  ["project-download"] = function(args, kwargs)
    assert(#args == 1, "project-download принимает ровно один идентификатор задания")
    local id = pandoc.utils.stringify(args[1])
    assert(id:match("^exr%-[a-z0-9][a-z0-9%-]*$"), "project-download требует идентификатор с префиксом exr-")
    for key, _ in pairs(kwargs) do
      assert(key == "text", "Неизвестный параметр project-download: " .. key)
    end
    local text = kwargs.text and pandoc.utils.stringify(kwargs.text) or ""
    if text == "" then text = "Скачать стартовый проект" end
    return pandoc.Span({pandoc.Str(text)}, pandoc.Attr("", {"course-project-download"}, {exercise = id}))
  end
}
