export function cn(...inputs: LooseValue[]) {
    return inputs.filter(Boolean).join(' ');
}
