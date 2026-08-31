module.exports = function(sequelize) {
  const { Model, DataTypes } = require("sequelize");

  class Thread extends Model {}

  Thread.init(
    {
      num: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      threadID: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      data: {
        type: DataTypes.JSON,
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: "FcaNeoProThread",
      timestamps: true
    }
  );
  return Thread;
};
