-- Техническая метка custom node переживает штатный native renderer.
local occurrence='data-course-core-occurrence'
local function mark(node,kind,container)
  local key=node.div.attributes[occurrence]
  if key then
    node.div.attributes['data-course-core-native-kind']=kind
    -- Нативная custom оболочка связывает собственный payload с ConditionalBlock.
    assert(container and container.attributes,'DOCUMENT_BINDING: нет native custom container')
    container.attributes[occurrence]=key
  end
  return node
end
return {{
  Theorem=function(node,container) return mark(node,'Theorem',container) end,
  Proof=function(node,container) return mark(node,'Proof',container) end,
  ConditionalBlock=function(node)
    local attributes=node.node.attributes
    if attributes and attributes[occurrence] then
      -- ConditionalBlock снимает свой Div. Немаркированная оболочка позволяет
      -- ему снять только её, сохранив собственный occurrence payload внутри.
      -- Видимость по-прежнему вычисляет renderer Quarto; hidden удаляет всё.
      node.node=pandoc.Div({node.node})
    end
    return node
  end
}}
