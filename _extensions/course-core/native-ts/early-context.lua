-- Только штатная native identity и транспорт; предметный договор декодирует TS.
local dir=pandoc.path.directory(debug.getinfo(1,'S').source:gsub('^@',''))
return {{Pandoc=function(doc)
  local loader=dofile(pandoc.path.join({dir,'request.lua'}))
  local request,path=loader(doc)
  assert(request,'OPERATION_BINDING: отсутствует native-ts route')
  local context=request.context
  if not os.getenv('COURSE_CORE_TS_RUN') then
    local role=pandoc.utils.stringify(doc.meta['course-core-role'] or 'page')
    assert(role=='exercise-bank' or role=='page','OPERATION_UNQUALIFIED: native role')
    context.exerciseBank=role=='exercise-bank'
    local defaults=doc.meta['exercise-defaults']
    if defaults then
      context.defaults={}
      for key,value in pairs(defaults) do
        local text=pandoc.utils.stringify(value)
        context.defaults[key]=key=='time' and tonumber(text) or text
      end
    end
  end
  local input=quarto.doc.input_file
  if pandoc.path.is_relative(input) then input=pandoc.path.join({assert(quarto.project.directory),input}) end
  assert(pandoc.path.normalize(input)==context.input,'DOCUMENT_BINDING: native input отличается')
  assert(quarto.doc.is_format(context.format),'DOCUMENT_BINDING: native format отличается')
  assert(pandoc.utils.stringify(doc.meta['course-core-projection'] or '')==context.projection,'DOCUMENT_BINDING: native projection отличается')
  assert(doc.meta['course-core-ts-context']==nil,'DOCUMENT_BINDING: вход уже имеет служебный context')
  assert(doc.meta['course-core-ts-request']==nil,'DOCUMENT_BINDING: авторский request запрещён')
  doc.meta['course-core-ts-request']=pandoc.MetaString(path)
  doc.meta['course-core-ts-context']=pandoc.MetaString(pandoc.json.encode(context))
  return pandoc.utils.run_json_filter(doc,pandoc.path.join({dir,'early-filter.sh'}),{FORMAT})
end}}
