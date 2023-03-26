const t = require('typy').default;
import Decimal from 'decimal.js'

//
// Various shared utility functions.
//

export function isObject(v: any): boolean {
    return t(v).isObject && !isDate(v);
}

export function isFunction(v: any): v is Function {
    return t(v).isFunction;
}

export function isString(v: any): v is string {
    return t(v).isString;
}

export function isDate(v: any): v is Date {
    return Object.prototype.toString.call(v) === "[object Date]";
}

export function isBoolean(v: any): v is boolean {
    return t(v).isBoolean;
}

export function isNumber(v: any): v is number {
    return t(v).isNumber;
}

export function isArray(v: any): v is Array<any> {
    return t(v).isArray;
}

export function isUndefined(v: any): boolean {
    return v === undefined;
}

// LONG (Buy): Realised PNL = (Close Price – Entry Price) * Position size * Contract Value (contract specific multiplier)
export const getLongRealisedPnl = (closePrice: Decimal, entryPrice: Decimal, positionSize: Decimal, contractValue: Decimal) => {
    const realisedPnl = closePrice.minus(entryPrice).times(positionSize).times(contractValue)
    return realisedPnl
}

// SHORT (Sell): Realised PNL = (Entry Price – Close Price) * Position size * Contract Value (contract specific multiplier)
export const getShortRealisedPnl = (closePrice: Decimal, entryPrice: Decimal, positionSize: Decimal, contractValue: Decimal) => {
    const realisedPnl = entryPrice.minus(closePrice).times(positionSize).times(contractValue)
    return realisedPnl
}
