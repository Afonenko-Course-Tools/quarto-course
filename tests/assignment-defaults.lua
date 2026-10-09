package.path=os.getenv('CANONICAL_EXTENSION')..'/?.lua;'..package.path
quarto={project={directory='/tmp'},doc={input_file='assignments.qmd'}}
local assessment=require('assessment')
return {{Pandoc=function(input)
 local function doc(extra)
 return pandoc.read('---\nassessment: {kind: seminar, related-exercise: exr-essay}\n---\n# Work {#sec-work}\n\n::: {.task-items requirement=optional work-mode=pair}\n1. @exr-one\n2. [@exr-two]{requirement=required work-mode=group '..(extra or '')..'}\n:::\n','markdown')
 end
 local work=assessment.collect(doc())
 assert(work.assignments['exr-one'].requirement=='optional','list requirement default missing')
 assert(work.assignments['exr-one'].workMode=='pair','list mode default missing')
 assert(work.assignments['exr-two'].requirement=='required' and work.assignments['exr-two'].workMode=='group','Span override lost')
 assert(work.assignments['exr-one'].stage==nil,'implicit classroom stage')
 assert(work.relatedExercise=='exr-essay','canonical relation missing')
 local ok,err=pcall(assessment.collect,doc('stage=homework'));assert(not ok and tostring(err):find('stage',1,true),'stage on Span accepted')
 io.stderr:write('PASS list defaults, Span override, absent stage and relation\n');return input
end}}
