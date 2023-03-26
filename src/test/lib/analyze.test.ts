import { expect } from 'chai';
import { analyze } from '../../lib/analyze';
import * as moment from 'dayjs';
import { ITrade } from '../..';
import { TradeDirection } from '../../lib/strategy';
import Decimal from 'decimal.js'
import { asDecimal } from '../../lib/backtest';

describe("analyze", () => {

    function makeDate(dateStr: string, fmt?: string): Date {
        return moment(dateStr, fmt || "YYYY/MM/DD").toDate();
    }

    it("analysis records starting capital", () => {
        const analysis1 = analyze(1000, []);
        expect(analysis1.startingCapital).to.eql(asDecimal(1000));

        const analysis2 = analyze(1200, []);
        expect(analysis2.startingCapital).to.eql(asDecimal(1200));
    });

    it("analysis of zero trades has zero profit", () => {
        const analysis = analyze(1000, []);
        expect(analysis.profit).to.eql(asDecimal(0));
        expect(analysis.profitPct).to.eql(asDecimal(0));
    });

    it("analysis of zero trades has no drawdown", () => {
        const analysis = analyze(1000, []);
        expect(analysis.maxDrawdown).to.eql(asDecimal(0));
        expect(analysis.maxDrawdownPct).to.eql(asDecimal(0));
    });

    it("analysis of zero trades has zero bar count", () => {
        const analysis = analyze(1000, []);
        expect(analysis.barCount).to.eql(asDecimal(0));
    });

    it("analysis of zero trades has undefined risk", () => {
        const analysis = analyze(1000, []);
        expect(analysis.maxRiskPct).to.eql(undefined);
    });

    it("analysis of zero trades records final capital to be the same as starting capital", () => {
        const analysis = analyze(2000, []);
        expect(analysis.finalCapital).to.eql(asDecimal(2000));
    });

    it("analysis of zero trades has undefined first and lastTradeDate", () => {
        const analysis = analyze(2000, []);
        expect(analysis.firstTradeDate).to.eql(undefined);
        expect(analysis.lastTradeDate).to.eql(undefined);
    });

    it("analysis of zero trades has undefined tradeSpan", () => {
        const analysis = analyze(2000, []);
        expect(analysis.tradeSpan).to.eql(undefined);
    });
    

    const aProfit: ITrade = {
        direction: TradeDirection.Long,
        entryTime: makeDate("2018/10/25"),
        entryPrice: asDecimal(10),
        exitTime: makeDate("2018/10/30"),
        exitPrice: asDecimal(20),
        profit: asDecimal(10),
        profitPct: asDecimal(100),
        riskPct: undefined,
        rmultiple: undefined,
        holdingPeriod: asDecimal(5),
        exitReason: "Sell",
    };

    it("can analyze single trade with profit", () => {
        const analysis = analyze(10, [ aProfit ]);
        expect(analysis.startingCapital).to.eql(asDecimal(10));
        expect(analysis.finalCapital).to.eql(asDecimal(20));
        expect(analysis.profit).to.eql(asDecimal(10));
        expect(analysis.profitPct).to.eql(asDecimal(100));
        expect(analysis.barCount).to.eql(asDecimal(5));
        expect(analysis.maxRiskPct).to.eql(undefined);
    });


    const aLoss: ITrade = {
        direction: TradeDirection.Long,
        entryTime: makeDate("2018/10/25"),
        entryPrice: asDecimal(10),
        exitTime: makeDate("2018/10/29"),
        exitPrice: asDecimal(5),
        profit: asDecimal(-5),
        profitPct: asDecimal(-50),
        riskPct: undefined,
        rmultiple: undefined,
        holdingPeriod: asDecimal(4),
        exitReason: "Sell",
    };



    it("can analyze single trade with loss", () => {
        const analysis = analyze(10, [ aLoss ] );
        expect(analysis.startingCapital).to.eql(asDecimal(10));

        expect(analysis.finalCapital).to.eql(asDecimal(5));
        expect(analysis.profit).to.eql(asDecimal(-5));
        expect(analysis.profitPct).to.eql(asDecimal(-50));
        expect(analysis.barCount).to.eql(asDecimal(4));
        expect(analysis.maxRiskPct).to.eql(undefined);
    });
    
    const twoProfits: ITrade[] = [
        {
            direction: TradeDirection.Long,
            entryTime: makeDate("2018/10/25"),
            entryPrice: asDecimal(10),
            exitTime: makeDate("2018/10/30"),
            exitPrice: asDecimal(20),
            profit: asDecimal(10),
            profitPct: asDecimal(100),
            riskPct: undefined,
            rmultiple: undefined,
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
            riskPct: undefined,
            rmultiple: undefined,
            holdingPeriod: asDecimal(10),
            exitReason: "Sell",
        },
    ];

    it("can analyze multiple trades with profit", () => {
        const analysis = analyze(10, twoProfits);
        expect(analysis.startingCapital).to.eql(asDecimal(10));
        expect(analysis.finalCapital).to.eql(asDecimal(60));
        expect(analysis.profit).to.eql(asDecimal(50));
        expect(analysis.profitPct).to.eql(asDecimal(500));
        expect(analysis.barCount).to.eql(asDecimal(15));
        expect(analysis.maxRiskPct).to.eql(undefined);
    });


    const twoLosses: ITrade[] = [
        {
            direction: TradeDirection.Long,
            entryTime: makeDate("2018/10/25"),
            entryPrice: asDecimal(20),
            exitTime: makeDate("2018/10/30"),
            exitPrice: asDecimal(10),
            profit: asDecimal(-10),
            profitPct: asDecimal(-50),
            riskPct: undefined,
            rmultiple: undefined,
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
            riskPct: undefined,
            rmultiple: undefined,
            holdingPeriod: asDecimal(10),
            exitReason: "Sell",
        },
    ];

    it("can analyze multiple trades with loss", () => {
        const analysis = analyze(20, twoLosses);
        expect(analysis.startingCapital).to.eql(asDecimal(20));
        expect(analysis.finalCapital).to.eql(asDecimal(8));
        expect(analysis.profit).to.eql(asDecimal(-12));
        expect(analysis.profitPct).to.eql(asDecimal(-60));
        expect(analysis.barCount).to.eql(asDecimal(15));
        expect(analysis.maxRiskPct).to.eql(undefined);
    });

    const aProfitThenALoss: ITrade[] = [
        {
            direction: TradeDirection.Long,
            entryTime: makeDate("2018/10/25"),
            entryPrice: asDecimal(10),
            exitTime: makeDate("2018/10/30"),
            exitPrice: asDecimal(20),
            profit: asDecimal(10),
            profitPct: asDecimal(100),
            riskPct: undefined,
            rmultiple: undefined,
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
            riskPct: undefined,
            rmultiple: undefined,
            holdingPeriod: asDecimal(10),
            exitReason: "Sell",
        },
    ];

    it("can analyze multiple trades with profit and loss", () => {
        const analysis = analyze(10, aProfitThenALoss);
        expect(analysis.startingCapital).to.eql(asDecimal(10));
        expect(analysis.finalCapital).to.eql(asDecimal(10));
        expect(analysis.profit).to.eql(asDecimal(0));
        expect(analysis.profitPct).to.eql(asDecimal(0));
        expect(analysis.barCount).to.eql(asDecimal(15));
        expect(analysis.maxRiskPct).to.eql(undefined);
    });

    const aLossThenAProfit: ITrade[] = [
        {
            direction: TradeDirection.Long,
            entryTime: makeDate("2018/10/25"),
            entryPrice: asDecimal(20),
            exitTime: makeDate("2018/10/30"),
            exitPrice: asDecimal(10),
            profit: asDecimal(-10),
            profitPct: asDecimal(-50),
            riskPct: undefined,
            rmultiple: undefined,
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
            riskPct: undefined,
            rmultiple: undefined,
            holdingPeriod: asDecimal(10),
            exitReason: "Sell",
        },
    ];

    it("can analyze multiple trades with loss and profit", () => {
        const analysis = analyze(20, aLossThenAProfit);
        expect(analysis.startingCapital).to.eql(asDecimal(20));
        expect(analysis.finalCapital).to.eql(asDecimal(20));
        expect(analysis.profit).to.eql(asDecimal(0));
        expect(analysis.profitPct).to.eql(asDecimal(0));
        expect(analysis.barCount).to.eql(asDecimal(15));
        expect(analysis.maxRiskPct).to.eql(undefined);
    });


    it("single trade with profit has no drawdown", () => {
        const analysis = analyze(10, [ aProfit ]);
        expect(analysis.maxDrawdown).to.eql(asDecimal(0));
        expect(analysis.maxDrawdownPct).to.eql(asDecimal(0));
    });

    it("single trade with loss sets the drawdown to the loss", () => {

        const analysis = analyze(10, [ aLoss ] );
        expect(analysis.maxDrawdown).to.eql(asDecimal(-5));
        expect(analysis.maxDrawdownPct).to.eql(asDecimal(-50));
    });
    
    it("drawdown from first loss is not override by subsequent profit", () => {

        const analysis = analyze(20, aLossThenAProfit);
        expect(analysis.maxDrawdown).to.eql(asDecimal(-10));
        expect(analysis.maxDrawdownPct).to.eql(asDecimal(-50));
    });

    const threeSampleTradesEndingInALoss: ITrade[] = [
        {
            direction: TradeDirection.Long,
            entryTime: makeDate("2018/10/25"),
            entryPrice: asDecimal(20),
            exitTime: makeDate("2018/10/30"),
            exitPrice: asDecimal(10),
            profit: asDecimal(-10),
            profitPct: asDecimal(-50),
            riskPct: asDecimal(50),
            rmultiple: asDecimal(-1),
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
            riskPct: asDecimal(50),
            rmultiple: asDecimal(4),
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
            riskPct: asDecimal(50),
            rmultiple: asDecimal(-1),
            holdingPeriod: asDecimal(5),
            exitReason: "Sell",
        },
    ];

    const threeSampleTradesEndingInAProfit: ITrade[] = [
        {
            direction: TradeDirection.Long,
            entryTime: makeDate("2018/10/25"),
            entryPrice: asDecimal(20),
            exitTime: makeDate("2018/10/30"),
            exitPrice: asDecimal(10),
            profit: asDecimal(10),
            profitPct: asDecimal(100),
            riskPct: asDecimal(50),
            rmultiple: asDecimal(-1),
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
            riskPct: asDecimal(50),
            rmultiple: asDecimal(4),
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
            riskPct: asDecimal(50),
            rmultiple: asDecimal(-1),
            holdingPeriod: asDecimal(5),
            exitReason: "Sell",
        },
    ];

    it("drawdown resets on peak", () => {
        const analysis = analyze(20, threeSampleTradesEndingInALoss);
        expect(analysis.maxDrawdown).to.eql(asDecimal(-15));
        expect(analysis.maxDrawdownPct).to.eql(asDecimal(-50));
    });

    it("total number of trades is recorded", () => {
        const analysis = analyze(20, threeSampleTradesEndingInALoss);
        expect(analysis.totalTrades).to.eql(asDecimal(3));
    });
    
    it("proportion profitable is computed", () => {
        const analysis = analyze(20, threeSampleTradesEndingInALoss);
        const numWinningTrades = asDecimal(1);
        const proportionWinning = numWinningTrades.div(3);
        
        expect(analysis.proportionProfitable).to.eql(proportionWinning);
    });

    it("percent profitable is computed", () => {

        const analysis = analyze(20, threeSampleTradesEndingInALoss);
        const numWinningTrades = asDecimal(1);
        const proportionWinning = numWinningTrades.div(3);

        expect(analysis.percentProfitable).to.eql(proportionWinning.times(100));
    });

    it("profit factor is computed with profits and losses", () => {

        const analysis = analyze(20, threeSampleTradesEndingInALoss);
        expect(analysis.profitFactor).to.eql(asDecimal(0.8));
    });

    it("profit factor is computed with only a profit", () => {

        const analysis = analyze(20, [ aProfit ]);
        expect(analysis.profitFactor).to.eql(undefined);
    });

    it("profit factor is computed with only a loss", () => {

        const analysis = analyze(20, [ aLoss ]);
        expect(analysis.profitFactor).to.eql(asDecimal(0));
    });

    it("expectency is computed", () => {

        const analysis = analyze(20, threeSampleTradesEndingInALoss);
        expect(analysis.expectency!.toFixed(2)).to.eql("0.67");
    });

    it("rmultiple std dev is computed", () => {

        const analysis = analyze(20, threeSampleTradesEndingInALoss);
        expect(analysis.rmultipleStdDev!.toFixed(2)).to.eql("2.89");
    });

    it("system quality is computed with profits and lossses", () => {

        const analysis = analyze(20, threeSampleTradesEndingInALoss);
        expect(analysis.systemQuality!.toFixed(2)).to.eql("0.23");
    });

    it("system quality is undefined with only a single profit", () => {

        const analysis = analyze(20, [ aProfit ]);
        expect(analysis.systemQuality).to.eql(undefined);
    });

    it("system quality is undefined with only a single loss", () => {

        const analysis = analyze(20, [ aLoss ]);
        expect(analysis.systemQuality).to.eql(undefined);
    });

    it("return on account is computed for a profit", () => {

        const analysis = analyze(20, threeSampleTradesEndingInAProfit);
        expect(analysis.returnOnAccount).to.eql(analysis.profitPct.div(Decimal.abs(analysis.maxDrawdownPct)))

    });

    it("return on account is computed for a loss", () => {

        const analysis = analyze(20, threeSampleTradesEndingInALoss);
        expect(analysis.returnOnAccount).to.eql(analysis.profitPct.div(Decimal.abs(analysis.maxDrawdownPct)))
    });

    it("can compute average profit per trade", () => {
        const analysis = analyze(10, twoProfits);
        expect(analysis.averageProfitPerTrade).to.eql(asDecimal(25));
    });

    it("can compute average profit for winning trades", () => {
        const analysis = analyze(10, twoProfits);
        expect(analysis.averageWinningTrade).to.eql(asDecimal(25));
    });

    it("can compute average profit for losing trades", () => {
        const analysis = analyze(10, twoLosses);
        expect(analysis.averageLosingTrade).to.eql(asDecimal(-6));
    });

    it("can compute positive expected value", () => {
        const analysis = analyze(10, twoProfits);
        expect(analysis.expectedValue).to.eql(asDecimal(25));
    });

    it("can compute negative expected value", () => {
        const analysis = analyze(10, twoLosses);
        expect(analysis.expectedValue).to.eql(asDecimal(-6));
    });
});
