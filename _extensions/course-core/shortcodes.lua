-- Emit a marker only. Visibility is projected before links or archives exist.
return {
  ["project-download"] = function(args, kwargs)
    assert(#args == 1, "project-download requires exactly one exercise ID")
    local id = pandoc.utils.stringify(args[1])
    assert(id:match("^exr%-[a-z0-9][a-z0-9%-]*$"), "project-download requires an exr- ID")
    for key, _ in pairs(kwargs) do
      assert(key == "text", "Unknown project-download option: " .. key)
    end
    local text = kwargs.text and pandoc.utils.stringify(kwargs.text) or ""
    if text == "" then text = "Скачать стартовый проект" end
    return pandoc.Span({pandoc.Str(text)}, pandoc.Attr("", {"course-project-download"}, {exercise = id}))
  end
}
