/** The gap is a pause when spoken, never the word "blank" run into the root (#2272). */
export const spokenGap = (sent: string): string => sent.replace('___', ' …');
