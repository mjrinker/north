export interface DepPopoverState {
  style: string;
  mode: 'and' | 'or';
  deps: { hid: string; name: string; met: boolean }[];
}
