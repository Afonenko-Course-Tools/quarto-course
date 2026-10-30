-- Техническая метка custom node переживает штатный native renderer.
local function mark(node,kind)
  if node.div.attributes['data-course-core-occurrence'] then node.div.attributes['data-course-core-native-kind']=kind end
  return node
end
return {{
  Theorem=function(node) return mark(node,'Theorem') end,
  Proof=function(node) return mark(node,'Proof') end
}}
