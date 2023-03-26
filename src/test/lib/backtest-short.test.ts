import { expect } from 'chai';
import { backtest } from '../../lib/backtest';
import { DataFrame, IDataFrame } from 'data-forge';
import { IBar } from '../../lib/bar';
import { IStrategy, EnterPositionFn, IEntryRuleArgs, ExitPositionFn, IExitRuleArgs, TradeDirection, StrategyOptions } from '../../lib/strategy';
import * as moment from 'dayjs';
import Decimal from 'decimal.js'
import { asDecimal } from '../../lib/backtest';
import { getLongRealisedPnl, getShortRealisedPnl } from 'grademark-sampo/src/lib/utils';

describe("backtest short", () => {

    const strategyOptions: StrategyOptions = {
        initialCapital: asDecimal(1000),
        leverage: asDecimal(7),
        symbol: 'XBTUSDTM',
        contractMultiplier: asDecimal(0.001)
    }

    function round(value: Decimal.Value) {
        return Decimal.round(asDecimal(value).times(100)).div(100)
    }

    function makeDate(dateStr: string, fmt?: string): Date {
        return moment(dateStr, fmt || "YYYY/MM/DD").toDate();
    }

    function mockBar(): IBarDef {
        return {
            time: "2018/10/20",
            close: asDecimal(2),
        };        
    }

    interface IBarDef {
        time: string;
        open?: Decimal;
        high?: Decimal;
        low?: Decimal;
        close: Decimal;
        volume?: Decimal;
    }

    function makeBar(bar: IBarDef): IBar {
        return {
            time: makeDate(bar.time),
            open: bar.open !== undefined ? bar.open : bar.close,
            high: bar.high !== undefined ? bar.high : bar.close,
            low: bar.low !== undefined ? bar.low : bar.close,
            close: bar.close,
            volume: bar.volume !== undefined ? bar.volume : asDecimal(1),
        };
    }

    function makeDataSeries(bars: IBarDef[]): IDataFrame<number, IBar> {
        return new DataFrame<number, IBar>(bars.map(makeBar));
    }

    const mockEntry = () => {};
    const mockExit = () => {};

    function mockStrategy(): IStrategy {
        return { 
            entryRule: mockEntry,
            exitRule: mockExit,
         };
    }

    function unconditionalShortEntry(enterPosition: EnterPositionFn, args: IEntryRuleArgs<IBar, {}>) {
        enterPosition({ direction: TradeDirection.Short }); // Unconditionally enter position at market price.
    };

    function unconditionalShortExit(exitPosition: ExitPositionFn, args: IExitRuleArgs<IBar, {}>) {
        exitPosition(); // Unconditionally exit position at market price.
    };

    const shortStrategyWithUnconditionalEntryAndExit: IStrategy = {
        entryRule: unconditionalShortEntry,
        exitRule: unconditionalShortExit,
    };
    
    const simpleInputSeries = makeDataSeries([
        { time: "2018/10/20", close: asDecimal(1) },
        { time: "2018/10/21", close: asDecimal(2) },
        { time: "2018/10/22", close: asDecimal(3) },
    ]);

    const longerDataSeries = makeDataSeries([
        { time: "2018/10/20", close: asDecimal(1) },
        { time: "2018/10/21", close: asDecimal(2) },
        { time: "2018/10/22", close: asDecimal(4) },
        { time: "2018/10/23", close: asDecimal(5) },
        { time: "2018/10/24", close: asDecimal(6) },
    ]);
    
    it('going short makes a loss when the price rises', () => {

        const entryPrice = asDecimal(3);
        const exitPrice = asDecimal(7);
        const inputSeries = makeDataSeries([
            { time: "2018/10/20", open: asDecimal(1), close: asDecimal(2) },
            { time: "2018/10/21", open: entryPrice, close: asDecimal(4) }, // Enter position at open on this day.
            { time: "2018/10/22", open: asDecimal(5), close: asDecimal(6) },
            { time: "2018/10/23", open: exitPrice, close: asDecimal(8) }, // Exit position at open on this day.
        ]);

        const trades = backtest(shortStrategyWithUnconditionalEntryAndExit, inputSeries, {strategyOptions});
        const singleTrade = trades[0];

        let compareProfit = asDecimal(0)

        if (singleTrade.size !== undefined && strategyOptions.leverage !== undefined) {
            compareProfit = singleTrade.direction === TradeDirection.Long ?
            getLongRealisedPnl(exitPrice, singleTrade.entryPrice, singleTrade.size as Decimal, strategyOptions.contractMultiplier) :
            getShortRealisedPnl(exitPrice, singleTrade.entryPrice, singleTrade.size as Decimal, strategyOptions.contractMultiplier)

        } else {
             compareProfit = singleTrade.direction === TradeDirection.Long 
            ? exitPrice.minus(entryPrice)
            : entryPrice.minus(exitPrice)
        }

        expect(singleTrade.profit).to.eql(compareProfit);
    });

    it('going short makes a profit when the price drops', () => {

        const entryPrice = asDecimal(6);
        const exitPrice = asDecimal(2);
        const inputSeries = makeDataSeries([
            { time: "2018/10/20", open: asDecimal(8), close: asDecimal(7) },
            { time: "2018/10/21", open: entryPrice, close: asDecimal(5) }, // Enter position at open on this day.
            { time: "2018/10/22", open: asDecimal(4), close: asDecimal(3) }, 
            { time: "2018/10/23", open: exitPrice, close: asDecimal(1) }, // Exit position at open on this day.
        ]);

        const trades = backtest(shortStrategyWithUnconditionalEntryAndExit, inputSeries, {strategyOptions});
        const singleTrade = trades[0];

        let compareProfit = asDecimal(0)

        if (singleTrade.size !== undefined && strategyOptions.leverage !== undefined) {
            compareProfit = singleTrade.direction === TradeDirection.Long ?
            getLongRealisedPnl(exitPrice, singleTrade.entryPrice, singleTrade.size as Decimal, strategyOptions.contractMultiplier) :
            getShortRealisedPnl(exitPrice, singleTrade.entryPrice, singleTrade.size as Decimal, strategyOptions.contractMultiplier)

        } else {
             compareProfit = singleTrade.direction === TradeDirection.Long 
            ? exitPrice.minus(entryPrice)
            : entryPrice.minus(exitPrice)
        }

        expect(singleTrade.profit).to.eql(compareProfit);
    });

    it("can exit short via stop loss", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalShortEntry,
            stopLoss: args => args.entryPrice.times(asDecimal(20).div(100))
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: asDecimal(100) },
            { time: "2018/10/21", close: asDecimal(100) }, // Entry day.
            { time: "2018/10/22", close: asDecimal(110) }, // Hold
            { time: "2018/10/23", close: asDecimal(120) }, // Stop loss triggered.
            { time: "2018/10/24", close: asDecimal(120) },
        ]);

        const trades = backtest(strategy, inputSeries, {strategyOptions});
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.stopPrice).to.eql(asDecimal(120));
        expect(singleTrade.exitReason).to.eql("stop-loss");
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/23"));
    });

    it("stop loss exits short based on intrabar high", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalShortEntry,
            stopLoss: args => args.entryPrice.times((asDecimal(20).div(100)))
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: asDecimal(100) },
            { time: "2018/10/21", close: asDecimal(100) }, // Entry day.
            { time: "2018/10/22", close: asDecimal(110) },  // Hold
            { time: "2018/10/23", open: asDecimal(110), high: asDecimal(120), low: asDecimal(100), close: asDecimal(105) },  // Stop loss triggered.
            { time: "2018/10/24", close: asDecimal(105) },
        ]);

        const trades = backtest(strategy, inputSeries, {strategyOptions});
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.exitPrice).to.eql(asDecimal(120));
    });

    it("stop loss is not triggered unless there is a significant rise", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalShortEntry,
            stopLoss: args => args.entryPrice.times((asDecimal(20).div(100)))
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: asDecimal(100) },
            { time: "2018/10/21", close: asDecimal(100) }, // Entry day
            { time: "2018/10/22", close: asDecimal(90) },  // Hold
            { time: "2018/10/23", close: asDecimal(85) },  // Hold
            { time: "2018/10/24", close: asDecimal(82) },  // Exit
        ]);

        const trades = backtest(strategy, inputSeries, {strategyOptions});
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.exitReason).to.eql("finalize");
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/24"));
    });

    it("can exit short via profit target", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalShortEntry,
            profitTarget: args => args.entryPrice.times(asDecimal(10).div(100))
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: asDecimal(100) },
            { time: "2018/10/21", close: asDecimal(100) }, // Entry day.
            { time: "2018/10/22", close: asDecimal(95) },  // Hold
            { time: "2018/10/23", close: asDecimal(90) },  // Profit target triggered.
            { time: "2018/10/24", close: asDecimal(90) },
        ]);

        const trades = backtest(strategy, inputSeries, {strategyOptions});
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.profitTarget).to.eql(asDecimal(90));
        expect(singleTrade.exitReason).to.eql("profit-target");
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/23"));
    });

    it("profit target exits short based on intrabar low", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalShortEntry,
            profitTarget: args => args.entryPrice.times(asDecimal(10).div(100))
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: asDecimal(100) },
            { time: "2018/10/21", close: asDecimal(100) }, // Entry day.
            { time: "2018/10/22", close: asDecimal(95) },  // Hold
            { time: "2018/10/23", open: asDecimal(95), high: asDecimal(100), low: asDecimal(90), close: asDecimal(95) },  // Profit target triggered.
            { time: "2018/10/24", close: asDecimal(95) },
        ]);

        const trades = backtest(strategy, inputSeries, {strategyOptions});
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.exitPrice).to.eql(asDecimal(90));
    });

    it("short exit is not triggered unless target profit is achieved", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalShortEntry,
            profitTarget: args => args.entryPrice.times(asDecimal(30).div(100))
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: asDecimal(100) },
            { time: "2018/10/21", close: asDecimal(100) }, // Entry day
            { time: "2018/10/22", close: asDecimal(100) },  // Hold
            { time: "2018/10/23", close: asDecimal(110) },  // Hold
            { time: "2018/10/24", close: asDecimal(120) },  // Exit
        ]);

        const trades = backtest(strategy, inputSeries, {strategyOptions});
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.exitReason).to.eql("finalize");
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/24"));
    });

    it("can exit short via trailing stop loss", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalShortEntry,
            trailingStopLoss: args => args.bar.close.times(asDecimal(20).div(100))
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: asDecimal(100) },
            { time: "2018/10/21", close: asDecimal(100) }, // Entry day.
            { time: "2018/10/22", close: asDecimal(110) }, // Hold
            { time: "2018/10/23", close: asDecimal(120) }, // Stop loss triggered.
            { time: "2018/10/24", close: asDecimal(120) },
        ]);

        const trades = backtest(strategy, inputSeries, {strategyOptions});
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.exitReason).to.eql("stop-loss");
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/23"));
    });

    it("can exit short via decreasing trailing stop loss", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalShortEntry,
            trailingStopLoss: args => args.bar.close.times(asDecimal(20).div(100))
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: asDecimal(100) },
            { time: "2018/10/21", close: asDecimal(100) }, // Entry day.
            { time: "2018/10/22", close: asDecimal(60) },  // Hold
            { time: "2018/10/23", close: asDecimal(72) },  // Stop loss triggered.
            { time: "2018/10/24", close: asDecimal(72) },
        ]);

        const trades = backtest(strategy, inputSeries, {strategyOptions});
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.exitReason).to.eql("stop-loss");
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/23"));
    });

    it("trailing stop loss exits short based on intrabar high", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalShortEntry,
            trailingStopLoss: args => args.bar.close.times(asDecimal(20).div(100))
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: asDecimal(100) },
            { time: "2018/10/21", close: asDecimal(100) }, // Entry day.
            { time: "2018/10/22", close: asDecimal(110) }, // Hold
            { time: "2018/10/23", open: asDecimal(110), high: asDecimal(120), low: asDecimal(100), close: asDecimal(110) }, // Stop loss triggered.
            { time: "2018/10/24", close: asDecimal(110) },
        ]);

        const trades = backtest(strategy, inputSeries, {strategyOptions});
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.exitPrice).to.eql(asDecimal(120));
    });

    it("trailing stop loss is not triggered unless there is a significant rise", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalShortEntry,
            trailingStopLoss: args => args.bar.close.times(asDecimal(20).div(100))
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: asDecimal(100) },
            { time: "2018/10/21", close: asDecimal(100) },  // Entry day
            { time: "2018/10/22", close: asDecimal(110) },  // Hold
            { time: "2018/10/23", close: asDecimal(115) },  // Hold
            { time: "2018/10/24", close: asDecimal(112) },  // Exit
        ]);

        const trades = backtest(strategy, inputSeries, {strategyOptions});
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.exitReason).to.eql("finalize");
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/24"));
    });

    it("can place intrabar conditional short order", () => {
        
        const strategy: IStrategy = {
            entryRule: (enterPosition, args) => {
                enterPosition({ 
                    direction: TradeDirection.Short, 
                    entryPrice: asDecimal(6), // Enter position when price hits 6.
                }); 
            },

            exitRule: mockExit,
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: asDecimal(10) },
            { time: "2018/10/21", close: asDecimal(9) },
            { time: "2018/10/22", close: asDecimal(8) },
            { time: "2018/10/23", close: asDecimal(7), low: asDecimal(6) }, // Intraday entry.
            { time: "2018/10/24", close: asDecimal(5) },
        ]);

        const trades = backtest(strategy, inputSeries, {strategyOptions});
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.entryTime).to.eql(makeDate("2018/10/23"));
    });
    
    it("conditional short order is not executed if price doesn't reach target", () => {
        
        const strategy: IStrategy = {
            entryRule: (enterPosition, args) => {
                enterPosition({ 
                    direction: TradeDirection.Short, 
                    entryPrice: asDecimal(6), // Enter position when price hits 6.
                }); 
            },

            exitRule: mockExit,
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: asDecimal(10) },
            { time: "2018/10/21", close: asDecimal(9) },
            { time: "2018/10/22", close: asDecimal(8) },
            { time: "2018/10/23", close: asDecimal(7) },
            { time: "2018/10/24", close: asDecimal(7) },
        ]);

        const trades = backtest(strategy, inputSeries, {strategyOptions});
        expect(trades.length).to.eql(0);
    });

    it("computes risk from initial stop", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalShortEntry,
            stopLoss: args => args.entryPrice.times(asDecimal(20).div(100))
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: asDecimal(100) },
            { time: "2018/10/21", close: asDecimal(100) }, // Entry day.
            { time: "2018/10/22", close: asDecimal(100) },
        ]);

        const trades = backtest(strategy, inputSeries, {strategyOptions});
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.riskPct).to.eql(asDecimal(20));
    });

    it("computes rmultiple from initial risk and profit", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalShortEntry,
            stopLoss: args => args.entryPrice.times(asDecimal(20).div(100))
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: asDecimal(100) },
            { time: "2018/10/21", close: asDecimal(100) }, // Entry day.
            { time: "2018/10/22", close: asDecimal(80) },
        ]);

        const trades = backtest(strategy, inputSeries, {strategyOptions});
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.rmultiple).to.eql(asDecimal(1));
    });

    it("computes rmultiple from initial risk and loss", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalShortEntry,
            stopLoss: args => args.entryPrice.times(asDecimal(20).div(100))
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: asDecimal(100) },
            { time: "2018/10/21", close: asDecimal(100) }, // Entry day.
            { time: "2018/10/22", close: asDecimal(120) },
        ]);

        const trades = backtest(strategy, inputSeries, {strategyOptions});
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.rmultiple).to.eql(asDecimal(-1));
    });

    it("current risk rises as profit increases", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalShortEntry,
            stopLoss: args => args.entryPrice.times(asDecimal(20).div(100))
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: asDecimal(100) },
            { time: "2018/10/21", close: asDecimal(100) }, // Entry day.
            { time: "2018/10/22", close: asDecimal(80) },
            { time: "2018/10/23", close: asDecimal(60) },
            { time: "2018/10/24", close: asDecimal(40) },
            { time: "2018/10/25", close: asDecimal(20) },
            { time: "2018/10/26", close: asDecimal(10) },
        ]);

        const trades = backtest(strategy, inputSeries, { recordRisk: true, strategyOptions });
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];

        const output = singleTrade.riskSeries!.map(risk => ({ time: risk.time, value: round(risk.value) }));
        expect(output).to.eql([
            {
                time: makeDate("2018/10/21"),
                value: asDecimal(20),
            },
            {
                time: makeDate("2018/10/22"),
                value: asDecimal(50),
            },
            {
                time: makeDate("2018/10/23"),
                value: asDecimal(100),
            },
            {
                time: makeDate("2018/10/24"),
                value: asDecimal(200),
            },
            {
                time: makeDate("2018/10/25"),
                value: asDecimal(500),
            },
            {
                time: makeDate("2018/10/26"),
                value: asDecimal(1100),
            },
        ]);
    });

    it("current risk remains low by trailing stop loss", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalShortEntry,
            trailingStopLoss: args => args.bar.close.times(asDecimal(20).div(100))
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: asDecimal(100) },
            { time: "2018/10/21", close: asDecimal(100) }, // Entry day.
            { time: "2018/10/22", close: asDecimal(80) },
            { time: "2018/10/23", close: asDecimal(60) },
            { time: "2018/10/24", close: asDecimal(40) },
            { time: "2018/10/25", close: asDecimal(20) },
            { time: "2018/10/26", close: asDecimal(10) },
        ]);

        const trades = backtest(strategy, inputSeries, { recordRisk: true, strategyOptions });
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];

        const output = singleTrade.riskSeries!.map(risk => ({ time: risk.time, value: round(risk.value) }));
        expect(output).to.eql([
            {
                time: makeDate("2018/10/21"),
                value: asDecimal(20),
            },
            {
                time: makeDate("2018/10/22"),
                value: asDecimal(20),
            },
            {
                time: makeDate("2018/10/23"),
                value: asDecimal(20),
            },
            {
                time: makeDate("2018/10/24"),
                value: asDecimal(20),
            },
            {
                time: makeDate("2018/10/25"),
                value: asDecimal(20),
            },
            {
                time: makeDate("2018/10/26"),
                value: asDecimal(20),
            },
        ]);
    });

    it('profit is computed for short trade finalized at end of the trading period', () => {

        const inputData = makeDataSeries([
            { time: "2018/10/20", close: asDecimal(10) },
            { time: "2018/10/21", close: asDecimal(10) },
            { time: "2018/10/22", close: asDecimal(5) },
        ]);
       
        const trades = backtest(shortStrategyWithUnconditionalEntryAndExit, inputData, {strategyOptions});
        const singleTrade = trades[0];


        let compareProfit = asDecimal(0)

        if (singleTrade.size !== undefined && strategyOptions.leverage !== undefined) {
            compareProfit = singleTrade.direction === TradeDirection.Long ?
            getLongRealisedPnl(singleTrade.exitPrice, singleTrade.entryPrice, singleTrade.size as Decimal, strategyOptions.contractMultiplier) :
            getShortRealisedPnl(singleTrade.exitPrice, singleTrade.entryPrice, singleTrade.size as Decimal, strategyOptions.contractMultiplier)

        } else {
             compareProfit = singleTrade.direction === TradeDirection.Long 
            ? singleTrade.exitPrice.minus(singleTrade.entryPrice)
            : singleTrade.entryPrice.minus(singleTrade.exitPrice)
        }

        expect(singleTrade.profit).to.eql(compareProfit);
        expect(singleTrade.profitPct).to.eql((compareProfit.div(singleTrade.entryPrice)).times(100));
    });

});
