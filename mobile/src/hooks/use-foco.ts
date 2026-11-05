import { useState } from 'react';

/** Estado de foco de um campo de texto, para destacar a borda enquanto ele está ativo. */
export function useFoco() {
  const [focado, setFocado] = useState(false);

  return {
    focado,
    propsDeFoco: {
      onFocus: () => setFocado(true),
      onBlur: () => setFocado(false),
    },
  };
}
