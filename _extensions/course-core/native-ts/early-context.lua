-- Только штатная native identity и транспорт; предметный договор декодирует TS.
return {{Pandoc=function(doc)
  local path=assert(os.getenv('COURSE_CORE_TS_RUN'),'COURSE_CORE_TS_RUN отсутствует')
  local file=assert(io.open(path,'rb'));local request=pandoc.json.decode(file:read('*a'));file:close()
  local context=request.context
  local input=quarto.doc.input_file
  if pandoc.path.is_relative(input) then input=pandoc.path.join({assert(quarto.project.directory),input}) end
  assert(pandoc.path.normalize(input)==context.input,'DOCUMENT_BINDING: native input отличается')
  assert(quarto.doc.is_format(context.format),'DOCUMENT_BINDING: native format отличается')
  assert(pandoc.utils.stringify(doc.meta['course-core-projection'] or '')==context.projection,'DOCUMENT_BINDING: native projection отличается')
  assert(doc.meta['course-core-ts-context']==nil,'DOCUMENT_BINDING: вход уже имеет служебный context')
  doc.meta['course-core-ts-context']=pandoc.MetaString(pandoc.json.encode(context))
  return pandoc.utils.run_json_filter(doc,pandoc.path.join({pandoc.path.directory(PANDOC_SCRIPT_FILE),'early-filter.sh'}),{FORMAT})
end}}
