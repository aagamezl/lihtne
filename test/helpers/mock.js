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
    createSpy: (target, method) => {
      return sinon.spy(target, method)
    },
    createStub: (target, method) => {
      return sinon.stub(target, method)
    },
    restoreStub: (target, method) => {
      target[method].restore()
    },
    createStubInstance: (Constructor, overrides) => {
      return sinon.createStubInstance(Constructor, overrides)
    },
    sinon,
    verifyMock: () => {
      mocks.forEach((mock) => {
        mock.verify()
      })
    }
  }
}

export default mock
