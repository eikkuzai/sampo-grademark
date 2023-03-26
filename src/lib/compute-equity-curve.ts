import { ITrade } from "./trade";
import { isArray } from "./utils";
import Decimal from "decimal.js";
import { asDecimal } from "./backtest";

/**
 * Compute an equity curve for a series of trades.
 * 
 * @param trades The series of trades to compute equity curve for.
 */
export function computeEquityCurve(startingCapital: Decimal.Value, trades: ITrade[]): number[] {

    if (!isArray(trades)) {
        throw new Error("Expected 'trades' argument to 'computeEquityCurve' to be an array that contains a set of trades for which to compute the equity curve.");
    }

    const equityCurve: number[] = [ asDecimal(startingCapital).toNumber() ];
    let workingCapital = asDecimal(startingCapital);

    for (const trade of trades) {
        workingCapital = workingCapital.plus(trade.profit);
        equityCurve.push(workingCapital.toNumber());
    }

    return equityCurve;
}