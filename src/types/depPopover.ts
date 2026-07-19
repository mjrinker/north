export interface DepPopoverState {
  habitId: string;
  style: string;
  mode: 'and' | 'or';
  deps: { hid: string; name: string; met: boolean }[];
}
