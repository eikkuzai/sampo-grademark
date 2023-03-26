import { expect } from "chai";
import { npDiff, npMean, npStd, sharpe } from "grademark-sampo/src/lib/metrics"
import { Decimal } from 'decimal.js'

describe("metrics:sharpe", () => {

    const sharpeTestValues = [100, 200, 400, 300, 250, 600, 575, 425, 325, 800, 900, 1020]

    it("npMean() should calculate mean for array", () => {
        const arr = [20, 2, 7, 1, 34]
        expect(npMean(arr)).to.eql(12.8)
    });

    it("npStd() should calculate standard deviation for array", () => {
        const arr1 = [1, 2, 3, 4, 5]
        const arr2 = [23, 4, 6, 457, 65, 7, 45, 8]
        expect(npStd(arr1)).to.eql(1.4142135623730951)
        expect(npStd(arr2)).to.eql(145.13565852332775)
    });

    it("npDiff() should calculate the difference between consecutive elements of an array", () => {
        const expected = [100, 200, -100, -50, 350, -25, -150, -100, 475, 100, 120]
        const valuesCopy = [...sharpeTestValues]
        expect(npDiff(valuesCopy)).to.eql(expected)
    });

    it("sharpe() should convert npDiff() result into pct change", () => {
        const valuesCopy = [...sharpeTestValues]
        const withoutFirst = valuesCopy.slice(1);
        const diff = npDiff(valuesCopy).map((d, i) => {
            return new Decimal(d).dividedBy(withoutFirst[i]).toNumber();
        });
        const expected = [0.5, 0.5, -0.3333333333333333, -0.2, 0.5833333333333334, -0.043478260869565216, -0.35294117647058826, -0.3076923076923077, 0.59375, 0.1111111111111111, 0.11764705882352941]
        expect(diff).to.eql(expected)
    })

    it("sharpe() should calculate ratio", () => {
        const valuesCopy = [...sharpeTestValues]
        const annualizeCoefficient = 12;
        const riskFreeRate = new Decimal(0.099);
        const expected = new Decimal(0.9292540351869186).toNumber()

        expect(sharpe(valuesCopy, riskFreeRate, annualizeCoefficient)).to.eql(expected)
    })
})
