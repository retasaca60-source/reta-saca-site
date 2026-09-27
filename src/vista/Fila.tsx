// Una fila "etiqueta … valor" de los resúmenes.

export function Fila({ etiqueta, valor, color }: { etiqueta: string; valor: string; color?: string }) {
  return (
    <div className="summary-row">
      <span className="label">{etiqueta}</span>
      <span className="value" style={color ? { color } : undefined}>
        {valor}
      </span>
    </div>
  )
}
