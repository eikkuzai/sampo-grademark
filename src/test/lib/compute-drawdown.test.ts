import { assert, expect } from 'chai';
import { computeDrawdown } from '../../lib/compute-drawdown';
import { DataFrame, IDataFrame } from 'data-forge';
import * as moment from 'dayjs';
import { ITrade } from '../..';
import { TradeDirection } from '../../lib/strategy';
import { asDecimal } from '../../lib/backtest';

describe("compute drawdown", () => {

    function makeDate(dateStr: string, fmt?: string): Date {
        return moment(dateStr, fmt || "YYYY/MM/DD").toDate();
    }

    it("no trades results in just starting drawdown of zero", () => {
        const startingCapital = 1000
        const drawdown = computeDrawdown(startingCapital, []);
        expect(drawdown.length).to.eql(1);
        expect(drawdown[0]).to.eql(0);
    });

    it("can compute drawdown for single trade with profit", () => {

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

        const drawdown = computeDrawdown(10, [ singleTrade ]);
        expect(drawdown.length).to.eql(2);
        expect(drawdown[1]).to.eql(asDecimal(0).toNumber());
    });

    it("can compute drawdown for single trade with loss", () => {

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

        const drawdown = computeDrawdown(10, [ singleTrade ]);
        expect(drawdown.length).to.eql(2);
        expect(drawdown[1]).to.eql(-5);
    });
    
    it("can compute drawdown for multiple trades with profit", () => {

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
                exitPrice: asDecimal(60),
                profit: asDecimal(40),
                profitPct: asDecimal(150),
                holdingPeriod: asDecimal(10),
                exitReason: "Sell",
            },
        ];

        const drawdown = computeDrawdown(10, trades);
        expect(drawdown.length).to.eql(3);
        expect(drawdown[1]).to.eql(0);
        expect(drawdown[2]).to.eql(0);
    });

    it("can compute drawdown for multiple trades with loss", () => {

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

        const drawdown = computeDrawdown(20, trades);
        expect(drawdown.length).to.eql(3);
        expect(drawdown[1]).to.eql(-10);
        expect(drawdown[2]).to.eql(-12);
    });

    it("can compute drawdown for multiple trades with profit and loss", () => {

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

        const drawdown = computeDrawdown(10, trades);
        expect(drawdown.length).to.eql(3);
        expect(drawdown[1]).to.eql(0);
        expect(drawdown[2]).to.eql(-10);
    });

    it("can compute drawdown for multiple trades with loss and profit", () => {

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

        const drawdown = computeDrawdown(20, trades);
        expect(drawdown.length).to.eql(3);
        expect(drawdown[1]).to.eql(-10);
        expect(drawdown[2]).to.eql(0);
    });

    it("drawdown resets on peak", () => {

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
                exitPrice: asDecimal(30),
                profit: asDecimal(20),
                profitPct: asDecimal(200),
                holdingPeriod: asDecimal(10),
                exitReason: "Sell",
            },
            {
                direction: TradeDirection.Long,
                entryTime: makeDate("2018/12/1"),
                entryPrice: asDecimal(30),
                exitTime: makeDate("2018/12/5"),
                exitPrice: asDecimal(15),
                profit: asDecimal(-15),
                profitPct: asDecimal(-50),
                holdingPeriod: asDecimal(5),
                exitReason: "Sell",
            },
        ];

        const drawdown = computeDrawdown(20, trades);
        expect(drawdown.length).to.eql(4);
        expect(drawdown[1]).to.eql(-10);
        expect(drawdown[2]).to.eql(0);
        expect(drawdown[3]).to.eql(-15);
    });
});