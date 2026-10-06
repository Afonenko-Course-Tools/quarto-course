-- Real native AST probe: the production visibility walk must retain the correct
-- option text and close controls and paired ordinary solutions in student.
package.path = os.getenv('CANONICAL_EXTENSION')..'/?.lua;'..package.path
quarto={project={profile={}},doc={is_format=function() return false end}}
local visibility = require('visibility')
local contract = require('pedagogy/contract')
return {{Pandoc=function(doc)
 local defaults={difficulty='advanced',time=20,workMode='pair'}
 local exercise=pandoc.Div({},pandoc.Attr('exr-metadata',{},{{'course-role','discussion'},{'difficulty','introductory'}}))
 local _,metadata=contract.describe(exercise,defaults,nil)
 assert(metadata.difficulty=='introductory' and metadata.time==nil and metadata.workMode=='pair','canonical metadata inherited page difficulty/time or lost work mode')
 local activity=pandoc.Div({},pandoc.Attr('',{},{{'course-role','prediction'}}))
 local _,display=contract.describe(activity,defaults,nil)
 assert(display.difficulty=='advanced' and display.time==20,'display activity defaults changed')
 local projected = visibility.prepare(doc)
 local text = pandoc.write(projected, 'markdown')
 assert(not text:match('PRIVATE_'), 'canonical closed content escaped student projection')
 assert(text:match('PUBLIC_CORRECT_OPTION'), 'correct option text removed')
 assert(not text:match('%.correct'), 'correct marker escaped student projection')
 assert(text:match('DEMO_SOLUTION'), 'demonstration solution removed')
 local format_seen=false
 projected:walk({Div=function(div)
   if div.identifier=='format-native' then
     format_seen=true
     assert(div.classes:includes('content-visible') and div.attributes['when-format']=='html','native format-only condition changed')
   end
 end})
 assert(format_seen,'format-only fixture missing')
 return projected
end}}
