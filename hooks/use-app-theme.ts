import { useMemo } from 'react';

import { darkPalette, gradients, lightPalette } from '@/constants/design';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useAppTheme() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  return useMemo(
    () => ({
      colors: scheme === 'dark' ? darkPalette : lightPalette,
      gradients: gradients[scheme],
      isDark: scheme === 'dark',
      scheme,
    }),
    [scheme]
  );
}
