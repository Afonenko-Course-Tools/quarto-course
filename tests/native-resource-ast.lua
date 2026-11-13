---@type {uses:fun(doc:pandoc.Pandoc):CourseStringList}
local resources = require("./native-resources")
---@param doc pandoc.Pandoc
---@return pandoc.Pandoc
local function verify(doc)
  ---@type pandoc.Pandoc
  local native = pandoc.Pandoc(pandoc.Blocks({
    pandoc.Div({
      pandoc.Para({
        pandoc.Image({ pandoc.Str("Изображение") }, "native.png?download=1#pixel"),
        pandoc.Space(),
        pandoc.Link({ pandoc.Str("Материал") }, "native.txt#part"),
        pandoc.Link({ pandoc.Str("Внешний") }, "https://example.invalid/remote.txt"),
      }),
      pandoc.RawBlock("html", '<img src="raw-block.png"><a href="raw-block.txt">HTML</a>'),
      pandoc.Para({ pandoc.RawInline("html", '<img SRC="raw-inline.png"><a HREF="raw-inline.txt">HTML</a>') }),
    }, pandoc.Attr("", { "public-tests" }, {})),
  }))
  local uses = resources.uses(native)
  assert(
    pandoc.json.encode(uses) == '["native.png","native.txt"]',
    "Core разобрал Raw HTML вместо native Image/Link: " .. pandoc.json.encode(uses)
  )
  print("PASS Lua: ресурсы только native Image/Link, RawBlock/RawInline непрозрачны")
  return doc
end
return { { Pandoc = verify } }
