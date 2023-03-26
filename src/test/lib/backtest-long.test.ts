import { expect } from 'chai';
import { backtest } from '../../lib/backtest';
import { DataFrame, IDataFrame } from 'data-forge';
import { IBar } from '../../lib/bar';
import { IStrategy, EnterPositionFn, IEntryRuleArgs, ExitPositionFn, IExitRuleArgs, TradeDirection, StrategyOptions } from '../../lib/strategy';
import * as moment from 'dayjs';
import { asDecimal } from '../../lib/backtest';
import Decimal from 'decimal.js'
import { getLongRealisedPnl } from 'grademark-sampo/src/lib/utils';

describe("backtest long", () => {

    const strategyOptions: StrategyOptions = {
        initialCapital: asDecimal(1000),
        leverage: asDecimal(7),
        symbol: 'XBTUSDTM',
        contractMultiplier: asDecimal(0.001)
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

    function unconditionalLongEntry(enterPosition: EnterPositionFn, args: IEntryRuleArgs<IBar, {}>) {
        enterPosition({ direction: TradeDirection.Long }); // Unconditionally enter position at market price.
    };

    function unconditionalLongExit(exitPosition: ExitPositionFn, args: IExitRuleArgs<IBar, {}>) {
        exitPosition(); // Unconditionally exit position at market price.
    };

    const longStrategyWithUnconditionalEntry: IStrategy = {
        entryRule: unconditionalLongEntry,
        exitRule: mockExit,
    };

    const longStrategyWithUnconditionalEntryAndExit: IStrategy = {
        entryRule: unconditionalLongEntry,
        exitRule: unconditionalLongExit,
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
    
    it('going long makes a profit when the price rises', () => {

        const entryPrice = asDecimal(3);
        const exitPrice = asDecimal(7);
        const inputSeries = makeDataSeries([
            { time: "2018/10/20", open: asDecimal(1), close: asDecimal(2) },
            { time: "2018/10/21", open: entryPrice, close: asDecimal(4) }, // Enter position at open on this day.
            { time: "2018/10/22", open: asDecimal(5), close: asDecimal(6) },
            { time: "2018/10/23", open: exitPrice, close: asDecimal(8) }, // Exit position at open on this day.
        ]);

        const trades = backtest(longStrategyWithUnconditionalEntryAndExit, inputSeries, {strategyOptions});
        const singleTrade = trades[0];

        const comparison = getLongRealisedPnl(singleTrade.exitPrice, singleTrade.entryPrice, singleTrade.size!, strategyOptions.contractMultiplier)
        expect(singleTrade.profit).to.eql(comparison);
    });

    it('going long makes a loss when the price drops', () => {

        const entryPrice = asDecimal(6);
        const exitPrice = asDecimal(2);
        const inputSeries = makeDataSeries([
            { time: "2018/10/20", open: asDecimal(8), close: asDecimal(7) },
            { time: "2018/10/21", open: entryPrice, close: asDecimal(5) }, // Enter position at open on this day.
            { time: "2018/10/22", open: asDecimal(4), close: asDecimal(3) }, 
            { time: "2018/10/23", open: exitPrice, close: asDecimal(1) }, // Exit position at open on this day.
        ]);

        const trades = backtest(longStrategyWithUnconditionalEntryAndExit, inputSeries, {strategyOptions});
        const singleTrade = trades[0];
        const comparison = getLongRealisedPnl(singleTrade.exitPrice, singleTrade.entryPrice, singleTrade.size!, strategyOptions.contractMultiplier)
        expect(singleTrade.profit).to.eql(comparison);
    });

    it("can exit long via stop loss", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
            stopLoss: args => args.entryPrice.times(asDecimal(20).div(100))
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: asDecimal(100) },
            { time: "2018/10/21", close: asDecimal(100) }, // Entry day.
            { time: "2018/10/22", close: asDecimal(90) },  // Hold
            { time: "2018/10/23", close: asDecimal(80) },  // Stop loss triggered.
            { time: "2018/10/24", close: asDecimal(70) },
        ]);

        const trades = backtest(strategy, inputSeries, {strategyOptions});
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.stopPrice).to.eql(asDecimal(80));
        expect(singleTrade.exitReason).to.eql("stop-loss");
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/23"));
    });

    it("stop loss exits long based on intrabar low", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
            stopLoss: args => args.entryPrice.times(asDecimal(20).div(100))
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: asDecimal(100) },
            { time: "2018/10/21", close: asDecimal(100) }, // Entry day.
            { time: "2018/10/22", close: asDecimal(90) },  // Hold
            { time: "2018/10/23", open: asDecimal(90), high: asDecimal(100), low: asDecimal(30), close: asDecimal(70) },  // Stop loss triggered.
            { time: "2018/10/24", close: asDecimal(70) },
        ]);

        const trades = backtest(strategy, inputSeries, {strategyOptions});
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.exitPrice).to.eql(asDecimal(80));
    });

    it("stop loss is not triggered unless there is a significant loss", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
            stopLoss: args => args.entryPrice.times(asDecimal(20).div(100))
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

    it("can exit long via profit target", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
            profitTarget: args => args.entryPrice.times(asDecimal(10).div(100))
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: asDecimal(100) },
            { time: "2018/10/21", close: asDecimal(100) }, // Entry day.
            { time: "2018/10/22", close: asDecimal(100) },  // Hold
            { time: "2018/10/23", close: asDecimal(110) },  // Profit target triggered.
            { time: "2018/10/24", close: asDecimal(110) },
        ]);

        const trades = backtest(strategy, inputSeries, {strategyOptions});
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.profitTarget).to.eql(asDecimal(110));
        expect(singleTrade.exitReason).to.eql("profit-target");
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/23"));
    });

    it("profit target exits long based on intrabar high", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
            profitTarget: args => args.entryPrice.times(asDecimal(10).div(100))
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: asDecimal(100) },
            { time: "2018/10/21", close: asDecimal(100) }, // Entry day.
            { time: "2018/10/22", close: asDecimal(90) },  // Hold
            { time: "2018/10/23", open: asDecimal(90), high: asDecimal(120), low: asDecimal(90), close: asDecimal(90) },  // Profit target triggered.
            { time: "2018/10/24", close: asDecimal(70) },
        ]);

        const trades = backtest(strategy, inputSeries, {strategyOptions});
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.exitPrice).to.eql(asDecimal(110));
    });

    it("long exit is not triggered unless target profit is achieved", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
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

    it("can exit long via trailing stop loss", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
            trailingStopLoss: args => args.bar.close.times(asDecimal(20).div(100))
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: asDecimal(100) },
            { time: "2018/10/21", close: asDecimal(100) }, // Entry day.
            { time: "2018/10/22", close: asDecimal(90) },  // Hold
            { time: "2018/10/23", close: asDecimal(70) },  // Stop loss triggered.
            { time: "2018/10/24", close: asDecimal(70) },
        ]);

        const trades = backtest(strategy, inputSeries, {strategyOptions});
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.exitReason).to.eql("stop-loss");
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/23"));
    });

    it("can exit long via rising trailing stop loss", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
            trailingStopLoss: args => args.bar.close.times(asDecimal(20).div(100))
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: asDecimal(100) },
            { time: "2018/10/21", close: asDecimal(100) },  // Entry day.
            { time: "2018/10/22", close: asDecimal(200) },  // Hold
            { time: "2018/10/23", close: asDecimal(150) },  // Stop loss triggered.
            { time: "2018/10/24", close: asDecimal(150) },
        ]);

        const trades = backtest(strategy, inputSeries, {strategyOptions});
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.exitReason).to.eql("stop-loss");
        expect(singleTrade.exitTime).to.eql(makeDate("2018/10/23"));
    });

    it("trailing stop loss exits long based on intrabar low", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
            trailingStopLoss: args => args.bar.close.times(asDecimal(20).div(100))
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: asDecimal(100) },
            { time: "2018/10/21", close: asDecimal(100) }, // Entry day.
            { time: "2018/10/22", close: asDecimal(90) },  // Hold
            { time: "2018/10/23", open: asDecimal(90), high: asDecimal(100), low: asDecimal(30), close: asDecimal(70) },  // Stop loss triggered.
            { time: "2018/10/24", close: asDecimal(70) },
        ]);

        const trades = backtest(strategy, inputSeries, {strategyOptions});
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.exitPrice).to.eql(asDecimal(80));
    });

    it("trailing stop loss is not triggered unless there is a significant loss", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
            trailingStopLoss: args => args.bar.close.times(asDecimal(20).div(100))
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
    
    it("can place intrabar conditional long order", () => {
        
        const strategy: IStrategy = {
            entryRule: (enterPosition, args) => {
                enterPosition({ 
                    direction: TradeDirection.Long, 
                    entryPrice: asDecimal(6), // Enter position when price hits 6.
                }); 
            },

            exitRule: mockExit,
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: asDecimal(1) },
            { time: "2018/10/21", close: asDecimal(2) },
            { time: "2018/10/22", close: asDecimal(4) },
            { time: "2018/10/23", close: asDecimal(5), high: asDecimal(6) }, // Intraday entry.
            { time: "2018/10/24", close: asDecimal(5) },
        ]);

        const trades = backtest(strategy, inputSeries, {strategyOptions});
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];
        expect(singleTrade.entryTime).to.eql(makeDate("2018/10/23"));
    });
    
    it("conditional long order is not executed if price doesn't reach target", () => {
        
        const strategy: IStrategy = {
            entryRule: (enterPosition, args) => {
                enterPosition({ 
                    direction: TradeDirection.Long, 
                    entryPrice: asDecimal(6), // Enter position when price hits 6.
                }); 
            },

            exitRule: mockExit,
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: asDecimal(1) },
            { time: "2018/10/21", close: asDecimal(2) },
            { time: "2018/10/22", close: asDecimal(3) },
            { time: "2018/10/23", close: asDecimal(4) },
            { time: "2018/10/24", close: asDecimal(5) },
        ]);

        const trades = backtest(strategy, inputSeries, {strategyOptions});
        expect(trades.length).to.eql(0);
    });

    it("computes risk from initial stop", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
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
            entryRule: unconditionalLongEntry,
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
        expect(singleTrade.rmultiple).to.eql(asDecimal(1));
    });

    it("computes rmultiple from initial risk and loss", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
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
        expect(singleTrade.rmultiple).to.eql(asDecimal(-1));
    });

    //TODO: make proper test
    it("current risk rises as profit increases", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
            stopLoss: args => args.entryPrice.times(asDecimal(20).div(100))
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: asDecimal(100) },
            { time: "2018/10/21", close: asDecimal(100) }, // Entry day.
            { time: "2018/10/22", close: asDecimal(150) },
            { time: "2018/10/23", close: asDecimal(140) },
            { time: "2018/10/24", close: asDecimal(200) },
            { time: "2018/10/25", close: asDecimal(190) },
            { time: "2018/10/26", close: asDecimal(250) },
        ]);

        const trades = backtest(strategy, inputSeries, { recordRisk: true, strategyOptions });
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];

        const output = singleTrade.riskSeries!.map(risk => ({ time: risk.time, value: risk.value }));
        expect(output.length).to.equal(6)
    });

    //TODO: make proper test
    it("current risk remains low by trailing stop loss", () => {
        
        const strategy: IStrategy = {
            entryRule: unconditionalLongEntry,
            trailingStopLoss: args => args.entryPrice.times(asDecimal(20).div(100))
        };

        const inputSeries = makeDataSeries([
            { time: "2018/10/20", close: asDecimal(100) },
            { time: "2018/10/21", close: asDecimal(100) }, // Entry day.
            { time: "2018/10/22", close: asDecimal(150) },
            { time: "2018/10/23", close: asDecimal(140) },
            { time: "2018/10/24", close: asDecimal(200) },
            { time: "2018/10/25", close: asDecimal(190) },
            { time: "2018/10/26", close: asDecimal(250) },
        ]);

        const trades = backtest(strategy, inputSeries, { recordRisk: true, strategyOptions });
        expect(trades.length).to.eql(1);

        const singleTrade = trades[0];

        const output = singleTrade.riskSeries!.map(risk => ({ time: risk.time, value: risk.value }));
        expect(output.length).to.eql(6)
    });

    it('profit is computed for long trade finalized at end of the trading period', () => {

        const inputData = makeDataSeries([
            { time: "2018/10/20", close: asDecimal(5) },
            { time: "2018/10/21", close: asDecimal(5) },
            { time: "2018/10/22", close: asDecimal(10) },
        ]);
       
        const trades = backtest(longStrategyWithUnconditionalEntry, inputData, {strategyOptions});
        const singleTrade = trades[0];

        const comparison = getLongRealisedPnl(singleTrade.exitPrice, singleTrade.entryPrice, singleTrade.size!, strategyOptions.contractMultiplier) 

        expect(singleTrade.profit).to.eql(comparison);
        expect(singleTrade.profitPct).to.eql(comparison.div(singleTrade.entryPrice).times(100));
    });
});
