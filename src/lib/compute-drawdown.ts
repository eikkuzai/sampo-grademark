import { ITrade } from "./trade";
import { isNumber, isObject, isArray} from "./utils";
import Decimal from "decimal.js";
import { asDecimal } from "./backtest";

/**
 * Compute drawdown for a series of trades.
 * 
 * @param trades The series of trades to compute drawdown for.
 */
export function computeDrawdown(startingCapital: Decimal.Value, trades: ITrade[]): number[] {

    if (!isNumber(startingCapital) || startingCapital <= 0) {
        throw new Error("Expected 'startingCapital' argument to 'computeDrawdown' to be a positive number that specifies the amount of capital used to compute drawdown.");
    }

    if (!isArray(trades)) {
        throw new Error("Expected 'trades' argument to 'computeDrawdown' to be an array that contains a set of trades for which to compute drawdown.");
    }

    const drawdown: number[] = [ 0 ];
    let workingCapital = asDecimal(startingCapital);
    let peakCapital = asDecimal(startingCapital);
    let workingDrawdown = asDecimal(0);

    for (const trade of trades) {
        workingCapital = workingCapital.plus(trade.profit);
        if (workingCapital.lt(peakCapital)) {
            workingDrawdown = workingCapital.minus(peakCapital);
        }
        else {
            peakCapital = workingCapital;
            workingDrawdown = asDecimal(0); // Reset at the peak.
        }
        drawdown.push(workingDrawdown.toNumber());
    }

    return drawdown;
}