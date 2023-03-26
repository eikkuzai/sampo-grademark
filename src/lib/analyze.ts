import { ITrade } from "./trade";
import * as math from 'mathjs';
import { IAnalysis } from "./analysis";
import { isNumber, isArray } from "./utils";
import { Series } from "data-forge";
import Decimal from "decimal.js";
import { asDecimal } from "./backtest";
import { calculateAverageDailyReturn, calmar, sharpe, SharpeOptions } from "../lib/metrics";

/**
 * Analyse a sequence of trades and compute their performance.
 */

export function analyze(startingCapital: Decimal.Value, trades: ITrade[], sharpeOptions?: SharpeOptions): IAnalysis {

    if (!isNumber(startingCapital) || startingCapital <= 0) {
        throw new Error("Expected 'startingCapital' argument to 'analyze' to be a positive number that specifies the amount of capital used to simulate trading.");
    }

    if (!isArray(trades)) {
        throw new Error("Expected 'trades' argument to 'analyze' to be an array that contains a set of trades to be analyzed.");
    }

    let sharpeParams: SharpeOptions = {
        coefficient: 12,
        riskFreeRate: 0.099
    }

    if (!!sharpeOptions && sharpeOptions.coefficient && sharpeOptions.riskFreeRate) {
        sharpeParams.riskFreeRate = sharpeOptions.riskFreeRate
        sharpeParams.coefficient = sharpeOptions.coefficient
    }

    let workingCapital = asDecimal(startingCapital);
    let barCount = asDecimal(0);
    let peakCapital = asDecimal(startingCapital);
    let workingDrawdown = asDecimal(0);
    let maxDrawdown = asDecimal(0);
    let maxDrawdownPct = asDecimal(0);
    let totalProfits = asDecimal(0);
    let totalLosses = asDecimal(0);
    let numWinningTrades = asDecimal(0);
    let numLosingTrades = asDecimal(0);
    let totalTrades = asDecimal(0);
    let maxRiskPct = undefined;
    let accountValues = [];
    let firstTradeDate = trades.length > 0 ? new Date(trades[0].entryTime) : undefined
    let lastTradeDate = trades.length > 0 ? new Date(trades[trades.length - 1].entryTime) : undefined

    for (const trade of trades) {

        totalTrades = totalTrades.plus(1)
        if (trade.riskPct !== undefined) {
            maxRiskPct = Decimal.max(trade.riskPct, maxRiskPct || 0);
        }

        accountValues.push(workingCapital.plus(trade.profit).toNumber())
        
        workingCapital = workingCapital.plus(trade.profit)
        barCount = barCount.plus(trade.holdingPeriod)

        if (workingCapital.lt(peakCapital)) {
            workingDrawdown = workingCapital.minus(peakCapital);
        }
        else {
            peakCapital = workingCapital;
            workingDrawdown = asDecimal(0); // Reset at the peak.
        }

        if (trade.profit.gt(0)) {
            totalProfits = totalProfits.plus(trade.profit);
            numWinningTrades = numWinningTrades.plus(1)
        }
        else {
            totalLosses = totalLosses.plus(trade.profit);
            numLosingTrades = numLosingTrades.plus(1)
        }

        maxDrawdown = Decimal.min(workingDrawdown, maxDrawdown);
        maxDrawdownPct = Decimal.min((maxDrawdown.div(peakCapital)).times(100), maxDrawdownPct);
    }


   const rmultiples = trades
        .filter(trade => trade.rmultiple !== undefined)
        .map(trade => trade.rmultiple!.toNumber());

    const expectency = rmultiples.length > 0 ? asDecimal(new Series(rmultiples).average()) : undefined;
    const rmultipleStdDev = rmultiples.length > 0
        ? asDecimal(math.std(rmultiples))
        : undefined;
    
    let systemQuality: Decimal | undefined;
    if (expectency !== undefined && rmultipleStdDev !== undefined) {
        if (rmultipleStdDev.equals(0)) {
            systemQuality = undefined;
        }
        else {
            systemQuality = expectency.div(rmultipleStdDev);
        }
    }

    let profitFactor: Decimal | undefined = undefined;
    const absTotalLosses = Decimal.abs(totalLosses);
    if (absTotalLosses.gt(0)) {
        profitFactor = totalProfits.div(absTotalLosses);
    }

    let tradeSpan = undefined;
    if (lastTradeDate && firstTradeDate) {
        const diffMs = Math.abs(lastTradeDate.getTime() - firstTradeDate.getTime());
        tradeSpan = Math.floor(diffMs / (1000 * 3600 * 24));
    }
    
    const profit = workingCapital.minus(startingCapital);
    const profitPct = (profit.div(startingCapital)).times(100)
    const proportionWinning = totalTrades.gt(0) ? numWinningTrades.div(totalTrades) : asDecimal(0);
    const proportionLosing = totalTrades.gt(0) ? numLosingTrades.div(totalTrades) : asDecimal(0);
    const averageWinningTrade = numWinningTrades.gt(0) ? totalProfits.div(numWinningTrades) : asDecimal(0);
    const averageLosingTrade = numLosingTrades.gt(0) ? totalLosses.div(numLosingTrades) : asDecimal(0);
    const adr = calculateAverageDailyReturn(trades)
    const adrPct = asDecimal(adr).times(100).toNumber()
    const analysis: IAnalysis = {
        startingCapital: asDecimal(startingCapital),
        finalCapital: workingCapital,
        profit: profit,
        profitPct: profitPct,
        totalTrades: totalTrades,
        barCount: barCount,
        tradeSpan: tradeSpan,
        firstTradeDate: firstTradeDate,
        lastTradeDate: lastTradeDate,
        maxDrawdown: maxDrawdown,
        maxDrawdownPct: maxDrawdownPct,
        maxRiskPct: maxRiskPct,
        expectency: expectency,
        rmultipleStdDev: rmultipleStdDev,
        systemQuality: systemQuality,
        profitFactor: profitFactor,
        proportionProfitable: proportionWinning,
        percentProfitable: proportionWinning.times(100),
        returnOnAccount: profitPct.div(Decimal.abs(maxDrawdownPct)),
        averageProfitPerTrade: profit.div(totalTrades),
        numWinningTrades: numWinningTrades,
        numLosingTrades: numLosingTrades,
        averageWinningTrade: averageWinningTrade,
        averageLosingTrade: averageLosingTrade,
        adr: adr,
        adrPct: adrPct,
        calmarRatio: calmar(adr, maxDrawdown.toNumber()),
        sharpeRatio: sharpe(accountValues, sharpeParams.riskFreeRate, sharpeParams.coefficient),
        expectedValue: (proportionWinning.times(averageWinningTrade)).plus(proportionLosing.times(averageLosingTrade)),
    };

    return analysis;
}