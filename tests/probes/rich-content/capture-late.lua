return { Pandoc = function(doc)
  local f = assert(io.open('bundle/post-ast.json', 'w'))
  f:write(pandoc.write(doc, 'json')); f:close()
  return doc
end }
