import * as Slot from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { cn } from '@/lib/utils';

const textVariants = cva('text-foreground text-base', {
  variants: {
    variant: {
      default: '',
      h1: 'text-4xl font-extrabold tracking-tight',
      h2: 'text-3xl font-semibold tracking-tight',
      h3: 'text-2xl font-semibold tracking-tight',
      h4: 'text-xl font-semibold tracking-tight',
      p: 'leading-7',
      muted: 'text-muted-foreground text-sm',
      small: 'text-sm font-medium leading-none',
      large: 'text-lg font-semibold',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

type TextVariantProps = VariantProps<typeof textVariants>;

export const TextClassContext = React.createContext<string | undefined>(undefined);

export type TextProps = RNTextProps &
  TextVariantProps & {
    asChild?: boolean;
  };

export function Text({ className, variant, asChild = false, ...props }: TextProps) {
  const parentClassName = React.useContext(TextClassContext);
  const Component = asChild ? Slot.Text : RNText;
  return (
    <Component className={cn(textVariants({ variant }), parentClassName, className)} {...props} />
  );
}
