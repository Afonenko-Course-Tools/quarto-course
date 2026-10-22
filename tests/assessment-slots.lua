package.path=os.getenv('CANONICAL_EXTENSION')..'/?.lua;'..package.path
quarto={project={directory='/tmp'},doc={input_file='slots.qmd'}}
local assessment=require('assessment')
return {{Pandoc=function(input)
 local function doc(item)
 return pandoc.read('---\nassessment: {kind: lab}\n---\n# Work {#sec-work}\n\n::: {.task-items stage=homework requirement=optional work-mode=pair}\n1. @exr-one\n1. '..item..'\n:::\n','markdown')
 end
 local conditional=assessment.collect(doc('[@exr-two]{.content-visible when-profile=hidden}'))
 assert(conditional.slots[2].candidates[1]=='exr-two','canonical condition lost before projection')
 local work=assessment.collect(doc('[@exr-two; @exr-three]{.task-alternatives #alt-numbers selection=random requirement=required}'))
 assert(work.slots and #work.slots==2,'compact alternatives must normalize to two slots')
 assert(work.slots[1].id=='exr-one' and work.slots[1].selection=='fixed','fixed stable ID')
 local slot=work.slots[2]
 assert(slot.id=='alt-numbers' and slot.selection=='random' and #slot.candidates==2,'random identity/candidates')
 assert(slot.assignment.requirement=='required' and slot.assignment.workMode=='pair' and slot.assignment.stage=='homework','slot inheritance')
 local choice=assessment.collect(doc('[@exr-two; @exr-three]{.task-alternatives #alt-choice selection=choice requirement=required}'))
 assert(choice.slots[2].selection=='choice' and #choice.slots[2].candidates==2 and choice.slots[2].assignment.requirement=='required','student choice must stay one required slot with both candidates')
 assert(work.items==nil and work.assignments==nil,'old transport removed')
 for _,item in ipairs({'[@exr-two; @exr-three]{.task-alternatives #alt-choice selection=choice requirement=optional}','[@exr-two]{.task-alternatives #alt-one selection=random}','[@exr-two; @exr-two]{.task-alternatives #alt-dup selection=random}','[@exr-two; @exr-three]{.task-alternatives selection=random}','[@exr-two; @exr-three]{.task-alternatives #alt-x selection=fixed}','[@exr-two; @exr-three]{.task-alternatives #alt-x selection=random unknown=yes}','[@exr-one; @exr-three]{.task-alternatives #alt-x selection=random}','@exr-two; @exr-three','[[@exr-two]{requirement=required}; @exr-three]{.task-alternatives #alt-nested selection=random}','[[@exr-two]{work-mode=group}; @exr-three]{.task-alternatives #alt-nested selection=random}'}) do
  local ok=pcall(assessment.collect,doc(item));assert(not ok,'malformed slot accepted: '..item)
 end
 io.stderr:write('PASS compact assessment slots and malformed alternatives\n');return input
end}}
