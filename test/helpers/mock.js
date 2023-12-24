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
    verifyMock: () => {
      mocks.forEach((mock) => {
        mock.verify()
      })
    }
  }
}

export default mock
