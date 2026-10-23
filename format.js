export const money = (value) => `ETB ${Number(value || 0).toLocaleString('en', { maximumFractionDigits: 2 })}`;

export const dateTime = (value) => value
  ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  : 'Not scheduled';