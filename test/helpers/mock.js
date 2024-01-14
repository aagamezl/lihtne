import sinon from 'sinon'

const mock = () => {
  const mocks = []

  return {
    /**
     *
     * @param {object} target
     * @returns {sinon.SinonMock}
     */
    createMock: (target) => {
      const newMock = sinon.mock(target)

      mocks.push(newMock)

      return newMock
    },
    createStub: (target, method) => {
      return sinon.stub(target, method)
    },
    createStubInstance: (Constructor, overrides) => {
      return sinon.createStubInstance(Constructor, overrides)
    },
    restoreStub: (target, method) => {
      target[method].restore()
    },
    verifyMock: () => {
      mocks.forEach((mock) => {
        mock.verify()
      })
    }
  }
}

export default mock
