local resources = require('./native-resources')
return {{Pandoc = function(doc)
  local native = pandoc.Pandoc({
    pandoc.Div({
      pandoc.Para({pandoc.Image('Изображение', 'native.png?download=1#pixel'),
        pandoc.Space(), pandoc.Link('Материал', 'native.txt#part'),
        pandoc.Link('Внешний', 'https://example.invalid/remote.txt')}),
      pandoc.RawBlock('html', '<img src="raw-block.png"><a href="raw-block.txt">HTML</a>'),
      pandoc.Para({pandoc.RawInline('html', '<img SRC="raw-inline.png"><a HREF="raw-inline.txt">HTML</a>')}),
    }, {class = 'public-tests'}),
  })
  local uses = resources.uses(native)
  assert(pandoc.json.encode(uses) == '["native.png","native.txt"]',
    'Core разобрал Raw HTML вместо native Image/Link: '..pandoc.json.encode(uses))
  print('PASS Lua: ресурсы только native Image/Link, RawBlock/RawInline непрозрачны')
  return doc
end}}
