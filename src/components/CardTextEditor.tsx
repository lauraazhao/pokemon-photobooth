import { EDITABLE_FIELDS, type CardData } from '../lib/cardData'

interface Props {
  data: CardData
  onChange: (data: CardData) => void
}

/** Side panel for editing the card text, shown after the photo is taken. Edits update the card live. */
export default function CardTextEditor({ data, onChange }: Props) {
  return (
    <aside className="panel" aria-label="Edit card text">
      <h2>Edit card</h2>
      <p className="panel-hint">Changes show on the card as you type.</p>
      <form className="editor" onSubmit={(e) => e.preventDefault()}>
        <fieldset>
      {EDITABLE_FIELDS.map((f) => {
        const value = data[f.key]
        const props = {
          id: `field-${f.key}`,
          value,
          maxLength: f.maxLength,
          onChange: (e: { target: { value: string } }) =>
            onChange({ ...data, [f.key]: f.multiline ? e.target.value : e.target.value.replace(/\n/g, ' ') }),
        }
        return (
          <div className="editor-field" key={f.key}>
            <label htmlFor={props.id}>
              {f.label}
              <span className="editor-count">
                {value.length}/{f.maxLength}
              </span>
            </label>
            {f.multiline ? <textarea rows={3} {...props} /> : <input type="text" {...props} />}
          </div>
        )
      })}
        </fieldset>
      </form>
    </aside>
  )
}
