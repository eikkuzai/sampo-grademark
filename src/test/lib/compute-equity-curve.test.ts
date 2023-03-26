import { assert, expect } from 'chai';
import { computeEquityCurve } from '../../lib/compute-equity-curve';
import { DataFrame, IDataFrame } from 'data-forge';
import * as moment from 'dayjs';
import { ITrade } from '../..';
import { TradeDirection } from '../../lib/strategy';
import { asDecimal } from '../../lib/backtest';

describe("compute equity curve", () => {

    function makeDate(dateStr: string, fmt?: string): Date {
        return moment(dateStr, fmt || "YYYY/MM/DD").toDate();
    }

    it("no trades results in equity curve with only starting capital", () => {
        const startingCapital = 1000
        const equityCurve = computeEquityCurve(startingCapital, []);
        expect(equityCurve.length).to.eql(1);
        expect(equityCurve[0]).to.eql(startingCapital);
    });

    it("can compute equity curve for single trade with profit", () => {

        const singleTrade: ITrade = {
            direction: TradeDirection.Long,
            entryTime: makeDate("2018/10/25"),
            entryPrice: asDecimal(10),
            exitTime: makeDate("2018/10/30"),
            exitPrice: asDecimal(20),
            profit: asDecimal(10),
            profitPct: asDecimal(100),
            holdingPeriod: asDecimal(5),
            exitReason: "Sell",
        };

        const startingCapital = asDecimal(100);
        const equityCurve = computeEquityCurve(startingCapital.toNumber(), [ singleTrade ]);
        expect(equityCurve.length).to.eql(2);
        expect(equityCurve[1]).to.eql(startingCapital.plus(singleTrade.profit).toNumber());
    });

    it("can compute equity curve for single trade with loss", () => {

        const singleTrade: ITrade = {
            direction: TradeDirection.Long,
            entryTime: makeDate("2018/10/25"),
            entryPrice: asDecimal(10),
            exitTime: makeDate("2018/10/29"),
            exitPrice: asDecimal(5),
            profit: asDecimal(-5),
            profitPct: asDecimal(-50),
            holdingPeriod: asDecimal(4),
            exitReason: "Sell",
        };

        const startingCapital = asDecimal(100);
        const equityCurve = computeEquityCurve(startingCapital.toNumber(), [ singleTrade ]);
        expect(equityCurve.length).to.eql(2);
        expect(equityCurve[1]).to.eql(startingCapital.plus(singleTrade.profit).toNumber());
    });
    
    it("can compute equity curve for multiple trades with profit", () => {

        const trades: ITrade[] = [
            {
                direction: TradeDirection.Long,
                entryTime: makeDate("2018/10/25"),
                entryPrice: asDecimal(10),
                exitTime: makeDate("2018/10/30"),
                exitPrice: asDecimal(20),
                profit: asDecimal(10),
                profitPct: asDecimal(100),
                holdingPeriod: asDecimal(5),
                exitReason: "Sell",
            },
            {
                direction: TradeDirection.Long,
                entryTime: makeDate("2018/11/1"),
                entryPrice: asDecimal(20),
                exitTime: makeDate("2018/11/10"),
                exitPrice: asDecimal(30),
                profit: asDecimal(10),
                profitPct: asDecimal(50),
                holdingPeriod: asDecimal(10),
                exitReason: "Sell",
            },
        ]

        const startingCapital = asDecimal(10);

        const equityCurve = computeEquityCurve(startingCapital.toNumber(), trades);
        expect(equityCurve.length).to.eql(3);
        expect(equityCurve[1]).to.eql(startingCapital.plus(trades[0].profit).toNumber());
        expect(equityCurve[2]).to.eql(startingCapital.plus(trades[0].profit).plus(trades[1].profit).toNumber());

    });

    it("can compute equity curve for multiple trades with loss", () => {

        const trades: ITrade[] = [
            {
                direction: TradeDirection.Long,
                entryTime: makeDate("2018/10/25"),
                entryPrice: asDecimal(20),
                exitTime: makeDate("2018/10/30"),
                exitPrice: asDecimal(10),
                profit: asDecimal(-10),
                profitPct: asDecimal(-50),
                holdingPeriod: asDecimal(5),
                exitReason: "Sell",
            },
            {
                direction: TradeDirection.Long,
                entryTime: makeDate("2018/11/1"),
                entryPrice: asDecimal(10),
                exitTime: makeDate("2018/11/10"),
                exitPrice: asDecimal(8),
                profit: asDecimal(-2),
                profitPct: asDecimal(-20),
                holdingPeriod: asDecimal(10),
                exitReason: "Sell",
            },
        ];

        const startingCapital = asDecimal(20);

        const equityCurve = computeEquityCurve(startingCapital.toNumber(), trades);
        expect(equityCurve.length).to.eql(3);
        expect(equityCurve[1]).to.eql(startingCapital.plus(trades[0].profit).toNumber());
        expect(equityCurve[2]).to.eql(startingCapital.plus(trades[0].profit).plus(trades[1].profit).toNumber());

    });

    it("can compute equity curve for multiple trades with profit and loss", () => {

        const trades: ITrade[] = [
            {
                direction: TradeDirection.Long,
                entryTime: makeDate("2018/10/25"),
                entryPrice: asDecimal(10),
                exitTime: makeDate("2018/10/30"),
                exitPrice: asDecimal(20),
                profit: asDecimal(10),
                profitPct: asDecimal(100),
                holdingPeriod: asDecimal(5),
                exitReason: "Sell",
            },
            {
                direction: TradeDirection.Long,
                entryTime: makeDate("2018/11/1"),
                entryPrice: asDecimal(20),
                exitTime: makeDate("2018/11/10"),
                exitPrice: asDecimal(10),
                profit: asDecimal(-10),
                profitPct: asDecimal(-50),
                holdingPeriod: asDecimal(10),
                exitReason: "Sell",
            },
        ];

        const startingCapital = asDecimal(20);

        const equityCurve = computeEquityCurve(startingCapital.toNumber(), trades);
        expect(equityCurve.length).to.eql(3);
        expect(equityCurve[1]).to.eql(startingCapital.plus(trades[0].profit).toNumber());
        expect(equityCurve[2]).to.eql(startingCapital.toNumber());
    });

    it("can compute equity curve for multiple trades with loss and profit", () => {

        const trades: ITrade[] = [
            {
                direction: TradeDirection.Long,
                entryTime: makeDate("2018/10/25"),
                entryPrice: asDecimal(20),
                exitTime: makeDate("2018/10/30"),
                exitPrice: asDecimal(10),
                profit: asDecimal(-10),
                profitPct: asDecimal(-50),
                holdingPeriod: asDecimal(5),
                exitReason: "Sell",
            },
            {
                direction: TradeDirection.Long,
                entryTime: makeDate("2018/11/1"),
                entryPrice: asDecimal(10),
                exitTime: makeDate("2018/11/10"),
                exitPrice: asDecimal(20),
                profit: asDecimal(10),
                profitPct: asDecimal(100),
                holdingPeriod: asDecimal(10),
                exitReason: "Sell",
            },
        ];

        let startingCapital = asDecimal(20);

        let equityCurve = computeEquityCurve(startingCapital.toNumber(), trades);
        expect(equityCurve.length).to.eql(3);
        expect(equityCurve[0]).to.eql(startingCapital.toNumber());
        expect(equityCurve[1]).to.eql(startingCapital.plus(trades[0].profit).toNumber());
        expect(equityCurve[2]).to.eql(startingCapital.plus(trades[0].profit).plus(trades[1].profit).toNumber());

    });
});