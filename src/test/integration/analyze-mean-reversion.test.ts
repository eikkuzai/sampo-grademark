/* DEPRECATED FOR NOW DUE TO DECIMAL.JS CHANGE

import * as path from 'path';
import 'data-forge-indicators';
import { readDataFrame, checkObjectExpectations } from './check-object';
import { ITrade, analyze } from '../..';
import { asDecimal } from 'grademark-sampo/src/lib/backtest';

describe("analyze mean reversion", function (this: any) {
    
    this.timeout(15000);

    it("with only profits", function  (this: any) {
        const sampleTrades: ITrade[] = readDataFrame<number, ITrade>(path.join(__dirname, "data/sample trades - all profits.dataframe"))
        .map((t) => {
            // Convert all decimal values to Decimal objects
            return {
                ...t,
                entryPrice: asDecimal(t.entryPrice),
                exitPrice: asDecimal(t.exitPrice),
                profit: asDecimal(t.profit),
                riskPct: t.riskPct ? asDecimal(t.riskPct) : undefined,
                holdingPeriod: asDecimal(t.holdingPeriod),
                rmultiple: t.rmultiple ? asDecimal(t.rmultiple) : undefined,
            }
        })
        .toArray();
        const analysis = analyze(10000, sampleTrades);
        checkObjectExpectations(analysis, this.test);
    });

    it("with only losses", function  (this: any) {
        const sampleTrades: ITrade[] = readDataFrame<number, ITrade>(path.join(__dirname, "data/sample trades - all losses.dataframe"))
        .map((t) => {
            // Convert all decimal values to Decimal objects
            return {
                ...t,
                entryPrice: asDecimal(t.entryPrice),
                exitPrice: asDecimal(t.exitPrice),
                profit: asDecimal(t.profit),
                riskPct: t.riskPct ? asDecimal(t.riskPct) : undefined,
                holdingPeriod: asDecimal(t.holdingPeriod),
                rmultiple: t.rmultiple ? asDecimal(t.rmultiple) : undefined,
            }
        })
        .toArray();
        const analysis = analyze(10000, sampleTrades);
        checkObjectExpectations(analysis, this.test);
    });

    it("with profits and losses", function  (this: any) {
        const sampleTrades: ITrade[] = readDataFrame<number, ITrade>(path.join(__dirname, "data/sample trades - profits and losses.dataframe"))
        .map((t) => {
            // Convert all decimal values to Decimal objects
            return {
                ...t,
                entryPrice: asDecimal(t.entryPrice),
                exitPrice: asDecimal(t.exitPrice),
                profit: asDecimal(t.profit),
                riskPct: t.riskPct ? asDecimal(t.riskPct) : undefined,
                holdingPeriod: asDecimal(t.holdingPeriod),
                rmultiple: t.rmultiple ? asDecimal(t.rmultiple) : undefined,
            }
        })
        .toArray();
        const analysis = analyze(10000, sampleTrades);
        checkObjectExpectations(analysis, this.test);
    });
});*/