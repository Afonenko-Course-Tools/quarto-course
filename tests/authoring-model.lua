package.path=os.getenv('CANONICAL_EXTENSION')..'/?.lua;'..package.path
quarto={project={directory='/tmp',profile={}},doc={input_file='authoring.qmd',is_format=function()return false end}}
package.preload['./contract']=function() return require('pedagogy/contract') end
local native=require('native-document')
local exercises=require('exercises')
local function document(content,bank)
 return pandoc.read('---\ncourse: {id: model}\n'..(bank and 'exercise-bank: true\nexercise-statement-visibility: open\n' or '')..'---\n# Topic {#sec-topic}\n\n'..content,'markdown')
end
local function task(attrs,body)
 return ':::: {#exr-one '..attrs..'}\n'..(body or 'Condition')..'\n::::\n'
end
local function rejects(name,content,code)
 local ok,err=pcall(native.validate,document(content,true))
 assert(not ok and tostring(err):find(code,1,true),name..': '..tostring(err))
end
return {{Pandoc=function(doc)
 local outside=document('::: {#exr-native}\nNative\n:::\n\n::: {#sol-unrelated}\nNative solution\n:::\n',false)
 native.validate(outside)
 assert(#exercises.collect(outside)==0,'native exercises collected outside bank')
 rejects('own difficulty required',task('time=10'),'CORE.METADATA_INVALID')
 rejects('own time required',task('difficulty=introductory'),'CORE.METADATA_INVALID')
 rejects('integer time required',task('difficulty=introductory time=1.5'),'CORE.METADATA_INVALID')
 rejects('hidden invalid raw', '::::: {.content-visible when-profile=full}\n'..task('difficulty=bad time=10')..':::::\n','CORE.METADATA_INVALID')
 rejects('solution for rejected',task('difficulty=introductory time=10','::: {.solution for=exr-one}\nAnswer\n:::'),'CORE.SOLUTION_PAIRING_INVALID')
 rejects('orphan suffix',task('difficulty=introductory time=10')..'::: {#sol-other}\nAnswer\n:::\n','CORE.SOLUTION_PAIRING_INVALID')
 rejects('duplicate anonymous',task('difficulty=introductory time=10','::: {.solution}\nAnswer\n:::\n\n::: {.solution}\nOther\n:::'),'CORE.SOLUTION_PAIRING_INVALID')
 local missing=document(task('difficulty=introductory time=10'),true)
 missing.meta['exercise-statement-visibility']=nil
 local ok,err=pcall(native.validate,missing)
 assert(not ok and tostring(err):find('statement-visibility',1,true),'implicit statement visibility accepted')
 local large=native.validate(document(task('difficulty=introductory time=1000001'),true))
 assert(large[1].time==1000001,'artificial task time cap remains')
 local facts=native.validate(document(task('difficulty=introductory time=10','::: {.solution}\nAnswer\n:::'),true))
 assert(#facts==1 and facts[1].hasSolution and facts[1].source=='authoring.qmd','raw own solution facts lost')
 io.stderr:write('PASS native AST bank boundary, hidden own fields and strict canonical solution pairing\n')
 return doc
end}}
