import Decimal from "decimal.js";

/**
 * Represents an analysis of a trading strategy.
 */
export interface IAnalysis {
    /**
     * Starting capital invested in the trading strategy.
     */
    startingCapital: Decimal;

    /**
     * Capital at the end of trading.
     */
    finalCapital: Decimal;

    /**
     * Amount of profit (or loss) made from start to end.
     */
    profit: Decimal;

    /**
     * Amount of profit as a percentage relative to the starting capital.
     */
    profitPct: Decimal;

    /**
     * Total number of trades considered.
     */
    totalTrades: Decimal;

    /**
     * Number of bars within trades.
     * NOTE: Doesn't include time/bars between trades (because that doesn't work with monte carlo simulation).
     */
    barCount: Decimal;

    /** Days between 1st trade date and the last trade date */
    tradeSpan?: number;

    /**
     * The maximum level of drawdown experienced during trading.
     * This is the cash that is lost from peak to lowest trough.
     */
    maxDrawdown: Decimal;

    /**
     * The maximum level of drawdown experienced during trading as a percentage of capital at the peak.
     * This is percent amount of lost from peak to lowest trough.
     */
    maxDrawdownPct: Decimal;

    /**
     * Maximum amount of risk taken at any point relative expressed as a percentage relative to the 
     * size of the account at the time.
     * This is optional and only set when a stop loss is applied in the strategy.
     */
    maxRiskPct?: Decimal;

    //
    // The estimated or actual expectency of the strategy.
    // P204 Trading your way to financial freedom.
    //
    expectency?: Decimal;

    //
    // The standard deviation tells you how much variability you can expect from your system's performance. 
    // In the sample our standard deviation was 1.86R. 
    // http://www.actionforex.com/articles-library/money-management-articles/every-trading-system-can-be-described-by-the-r-multiples-it-generates-200604136408/
    //
    rmultipleStdDev?: Decimal;
    
    //
    // The estimated or actual quality of the strategy.
    // Expectency / std devation of rmultiples.
    // Only computed when stop loss is used for a strategy, otherwise set to undefined.
    // Result is also undefined when there is no deviation in profits from trades 
    // (this might happen if all trades in your backtest are stopped out at the same loss).
    //
    /*
    Typically you can tell how good your system is by the ratio of the expectancy to the standard deviation.
    In our small sample, the ratio is 0.36, which is excellent. After a 100 or so trades, I'd expect this ratio to be much smaller, but if it remains above 0.25, we have a superb system. But that's another story.
    http://www.actionforex.com/articles-library/money-management-articles/every-trading-system-can-be-described-by-the-r-multiples-it-generates-200604136408/
    */
    systemQuality?: Decimal;
    
    /**
     * The ratio of wins to losses.
     * Values above 2 are outstanding.
     * Values above 3 are unheard of.
     * Set to undefined if there are no losses.
     */
    profitFactor: Decimal | undefined;

    /**
     * The proportion of trades that were winners.
     * A value in gthe range 0-1.
     */
    proportionProfitable: Decimal;

    /**
     * The percentage of trades that were winners.
     * A value in the range 0-100.
     * This could also be called reliability or accuracy.
     */
    percentProfitable: Decimal;

    /**
     * Ratio of net profit to max drawdown. 
     * Useful metric for comparing strategies.
     * The higher the better.
     * Similar to the calmar ratio:
     * http://www.investopedia.com/terms/c/calmarratio.asp
     */
    returnOnAccount: Decimal;

    /**
     * The average profit per trade.
     * 
     * = profit / totalTrades
     */
    averageProfitPerTrade: Decimal;

    /**
     * The number of trades in profit.
     */
    numWinningTrades: Decimal;

    /**
     * The number of trades at a loss.
     */
    numLosingTrades: Decimal;

    /**
     * Average profit from winning trades.
     */
    averageWinningTrade: Decimal;

    /**
     * Average profit from losing trades.
     */
    averageLosingTrade: Decimal;

    /**
     * Mathematical expectency.
     * P29 Trading Systems.
     * = % winning * avgh win + % losing * avg los
     * Want this number to be positive.
     * Can be used to rank trading strategies. Higher value is better.
     * 
     * https://en.wikipedia.org/wiki/Expected_value
     */
    expectedValue: Decimal;
    adr?: number;
    adrPct?: number;
    calmarRatio?: number;
    sharpeRatio?: number;
    accountValues?: Array<number>;
    firstTradeDate?: Date;
    lastTradeDate?: Date;
}
